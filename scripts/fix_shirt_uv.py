"""Build viewer-compatible front/back print UVs for the selected shirt mesh.

Import the model manually in Blender, select its garment mesh, then run this
script. It preserves the original UV layer and only changes the print UV layer
in the current Blender scene. It does not export or save any files.
"""

import bpy


VIEW_COUNT = 2
# If the viewer's Frente receives the back panel, change this to -1 and rerun.
FRONT_SIGN = 1
PRINT_UV_NAME = "UVMap_Print"

# Keep texture filtering from sampling across the join between the two halves.
# This is a fraction of each half-panel, not a global UV normalization factor.
PANEL_GUTTER = 0.002

# The viewer maps the panorama with repeat.x = -1, offset.x = 0, and
# RepeatWrapping. After that horizontal flip, canvas view 0 (Frente, left half)
# occupies UV U=0.5..1 and view 1 (Espalda, right half) occupies U=0..0.5.
# Do not unwrap/recenter/scale these UVs afterward: the viewer relies on those
# exact domains. The mesh's original UV_0 remains untouched for its shirt map.


def find_print_body(objects):
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Selecciona la malla de la camisa antes de ejecutar el script.")

    garment_names = ("camis", "shirt", "sudadera", "sweat", "cloth", "torso", "body", "printable")
    preferred = [obj for obj in meshes if any(term in obj.name.lower() for term in garment_names)]
    return max(preferred or meshes, key=lambda obj: len(obj.data.vertices))


def ensure_print_uv_is_second(mesh):
    """Return a TEXCOORD_1 layer without replacing the original TEXCOORD_0."""
    original_uv = mesh.uv_layers.active
    if original_uv is None:
        raise RuntimeError("La malla no tiene UV originales; no puedo conservar la textura de la camisa.")

    print_uv = mesh.uv_layers.get(PRINT_UV_NAME)
    if print_uv is None:
        print_uv = mesh.uv_layers.new(name=PRINT_UV_NAME)

    print_index = list(mesh.uv_layers).index(print_uv)
    if print_index != 1:
        raise RuntimeError(
            f'"{PRINT_UV_NAME}" debe ser la segunda capa UV (TEXCOORD_1); '
            f'ahora ocupa el índice {print_index}. Ordena las capas UV para dejar '
            "la UV original primero y vuelve a ejecutar."
        )
    if original_uv == print_uv:
        raise RuntimeError("La capa UV original no puede ser también UVMap_Print.")
    return print_uv


def rebuild_garment_uv(obj):
    """Project each surface onto its front/back panel in viewer texture space."""
    mesh = obj.data
    if not mesh.vertices or not mesh.polygons:
        raise RuntimeError(f'La malla "{obj.name}" no tiene geometría.')
    if VIEW_COUNT != 2:
        raise RuntimeError("Este mapeo requiere dos vistas: Frente y Espalda.")
    if FRONT_SIGN not in (-1, 1):
        raise RuntimeError("FRONT_SIGN debe ser 1 o -1.")
    if not 0 <= PANEL_GUTTER < 0.1:
        raise RuntimeError("PANEL_GUTTER debe estar entre 0 y 0.1.")

    # Project in world space so the result follows the imported model's actual
    # orientation, including its GLB axis conversion and object transforms.
    points = [obj.matrix_world @ vertex.co for vertex in mesh.vertices]
    mins = [min(point[axis] for point in points) for axis in range(3)]
    maxs = [max(point[axis] for point in points) for axis in range(3)]
    spans = [maxs[axis] - mins[axis] for axis in range(3)]
    center = [(mins[axis] + maxs[axis]) * 0.5 for axis in range(3)]

    vertical_axis = max(range(3), key=lambda axis: spans[axis])
    if spans[vertical_axis] <= 1e-8:
        raise RuntimeError("No se pudo detectar el eje vertical de la prenda.")
    horizontal_axes = [axis for axis in range(3) if axis != vertical_axis]
    width_axis = max(horizontal_axes, key=lambda axis: spans[axis])
    depth_axis = min(horizontal_axes, key=lambda axis: spans[axis])
    if spans[width_axis] <= 1e-8 or spans[depth_axis] <= 1e-8:
        raise RuntimeError("La camisa debe tener ancho y profundidad para generar los dos paneles.")

    print_uv = ensure_print_uv_is_second(mesh)
    # Classify every polygon by the side of the garment's center plane where
    # its centroid lies. This model is densely triangulated and has noisy face
    # normals; normal-based classification split the same front/back surfaces
    # into many tiny islands, which made the print appear only on sleeves/hem.
    panel_for_face = []
    panel_face_counts = [0, 0]
    for polygon in mesh.polygons:
        face_depth = sum(
            points[mesh.loops[loop_index].vertex_index][depth_axis]
            for loop_index in polygon.loop_indices
        ) / max(1, len(polygon.loop_indices))
        panel_index = 0 if (face_depth - center[depth_axis]) * FRONT_SIGN >= 0 else 1
        panel_for_face.append(panel_index)
        panel_face_counts[panel_index] += 1

    min_u, max_u = float("inf"), float("-inf")
    min_v, max_v = float("inf"), float("-inf")
    for polygon, panel_index in zip(mesh.polygons, panel_for_face):
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            point = points[vertex_index]
            horizontal = (point[width_axis] - mins[width_axis]) / spans[width_axis]

            # The back is viewed from the opposite direction, so its screen
            # horizontal axis is reversed relative to the front.
            if panel_index == 1:
                horizontal = 1.0 - horizontal

            # First lay out the editor's two image halves, then reverse U to
            # compensate for the viewer's negative texture repeat.
            panel_x = (panel_index + PANEL_GUTTER + horizontal * (1 - 2 * PANEL_GUTTER)) / VIEW_COUNT
            u = 1.0 - panel_x
            v = (point[vertical_axis] - mins[vertical_axis]) / spans[vertical_axis]
            print_uv.data[loop_index].uv = (u, v)
            min_u, max_u = min(min_u, u), max(max_u, u)
            min_v, max_v = min(min_v, v), max(max_v, v)

    mesh.update()
    # Keep the original first layer active for Blender material preview/export;
    # glTF still writes UVMap_Print as TEXCOORD_1 based on its layer order.
    mesh.uv_layers.active_index = 0
    return vertical_axis, width_axis, depth_axis, panel_face_counts, (min_u, max_u, min_v, max_v)


def main():
    selected_before = list(bpy.context.selected_objects)
    body = find_print_body(selected_before)
    vertical_axis, width_axis, depth_axis, panel_counts, uv_bounds = rebuild_garment_uv(body)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in selected_before:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = body
    axis_name = "XYZ"
    min_u, max_u, min_v, max_v = uv_bounds
    print("\nUV para visor de camisa generadas en Blender.")
    print(f"Malla imprimible: {body.name}")
    print(f"UV original conservada; {PRINT_UV_NAME} está en la segunda capa y se exportará como TEXCOORD_1.")
    print(f"Eje vertical/ancho/profundidad: {axis_name[vertical_axis]}/{axis_name[width_axis]}/{axis_name[depth_axis]}")
    print(f"Caras asignadas (frente/espalda): {panel_counts}")
    print(f"Rango UV de impresión: U {min_u:.4f}–{max_u:.4f} · V {min_v:.4f}–{max_v:.4f}")
    print("No se abrieron ni normalizaron UV cilíndricas; se conserva el dominio por panel para RepeatWrapping.")
    print(f"UV corregidas en la escena actual: {body.name}")
    print("No se exportó ni guardó ningún archivo.\n")


if __name__ == "__main__":
    main()
