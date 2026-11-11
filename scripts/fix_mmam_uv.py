"""Rebuild the printable body's UVs as a continuous cylindrical strip.

Run from Blender with: blender --python scripts/fix_mmam_uv.py
The input GLB is preserved; a corrected copy is written next to it.
"""

from pathlib import Path
import math

import bpy


def find_project_dir() -> Path:
    """Find the project even when Blender runs an unsaved text block (/Text)."""
    candidates = []

    # When this script is run from its saved file, its parent folders include
    # the project root. Unsaved Blender text blocks usually resolve to /Text.
    try:
        candidates.extend(Path(__file__).resolve().parents)
    except (NameError, OSError):
        pass

    # Also check Blender's current .blend folder and its working directory.
    if bpy.data.filepath:
        candidates.extend(Path(bpy.data.filepath).resolve().parents)
    candidates.extend(Path.cwd().resolve().parents)

    # Known workspace path, used as a fallback for an unsaved Blender script.
    candidates.append(Path("/Users/brayansandovalbravo/Documents/Tienda"))

    for candidate in candidates:
        if (candidate / "public" / "models" / "mmam.glb").is_file():
            return candidate

    searched = "\n".join(f"- {path / 'public' / 'models' / 'mmam.glb'}" for path in candidates)
    raise FileNotFoundError(
        "No encontré mmam.glb. Guarda este script dentro de la carpeta del "
        "proyecto o actualiza INPUT_GLB. Rutas revisadas:\n" + searched
    )


PROJECT_DIR = find_project_dir()
INPUT_GLB = PROJECT_DIR / "public" / "models" / "mmam.glb"
OUTPUT_GLB = PROJECT_DIR / "public" / "models" / "mmam_uv_corregido_v2.glb"


def import_model(path: Path) -> list:
    if not path.is_file():
        raise FileNotFoundError(f"No se encontró el modelo: {path}")

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for obj in bpy.data.objects if obj not in before]


def find_print_body(objects: list):
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("El GLB no contiene objetos de tipo malla.")

    # Prefer the exact body mesh from mmam.glb; fall back to the largest mesh
    # if Blender changes or removes the imported object name.
    preferred = [obj for obj in meshes if "botella" in obj.name.lower()]
    if preferred:
        return max(preferred, key=lambda obj: len(obj.data.vertices))
    return max(meshes, key=lambda obj: len(obj.data.vertices))


def rebuild_cylindrical_uv(obj) -> tuple[int, int]:
    mesh = obj.data
    if not mesh.vertices or not mesh.polygons:
        raise RuntimeError(f'La malla "{obj.name}" no tiene geometría.')

    # Work in world space so the result is independent of GLB axis conversion
    # and object transforms applied by Blender's importer.
    points = [obj.matrix_world @ vertex.co for vertex in mesh.vertices]
    mins = [min(point[axis] for point in points) for axis in range(3)]
    maxs = [max(point[axis] for point in points) for axis in range(3)]
    spans = [maxs[axis] - mins[axis] for axis in range(3)]
    vertical_axis = max(range(3), key=lambda axis: spans[axis])
    if spans[vertical_axis] <= 1e-8:
        raise RuntimeError("No se pudo detectar el eje vertical del cuerpo.")

    radial_axes = [axis for axis in range(3) if axis != vertical_axis]
    center = [(mins[axis] + maxs[axis]) * 0.5 for axis in range(3)]
    angles = []
    heights = []
    for point in points:
        a, b = radial_axes
        angle = math.atan2(point[b] - center[b], point[a] - center[a])
        # Product3DViewer mirrors U when it maps the print texture. Reverse
        # this cylindrical coordinate so lettering reads normally in 3D.
        angles.append((-angle / (2.0 * math.pi)) % 1.0)
        heights.append((point[vertical_axis] - mins[vertical_axis]) / spans[vertical_axis])

    uv_layer = mesh.uv_layers.active
    if uv_layer is None:
        uv_layer = mesh.uv_layers.new(name="UVMap_Print")
    else:
        uv_layer.name = "UVMap_Print"

    # Unwrap each face across the 0/1 seam using the shorter angular interval.
    # UVs are stored per loop, so the seam can have U=0 on one side and U=1
    # on the other without duplicating or changing the mesh geometry.
    loop_u = [0.0] * len(mesh.loops)
    for polygon in mesh.polygons:
        values = [angles[mesh.loops[loop_index].vertex_index] for loop_index in polygon.loop_indices]
        crosses_seam = bool(values) and max(values) - min(values) > 0.5
        for loop_index in polygon.loop_indices:
            value = angles[mesh.loops[loop_index].vertex_index]
            if crosses_seam and value < 0.5:
                value += 1.0
            loop_u[loop_index] = value

    # Keep the angular UV scale intact. Seam faces can have U > 1; the 3D
    # viewer uses RepeatWrapping, so these coordinates wrap correctly. A
    # global normalization here compresses U and makes the first panorama
    # segment (at the 0/1 seam) cover only a small part of the bottle.
    for loop_index, loop in enumerate(mesh.loops):
        uv_layer.data[loop_index].uv = (loop_u[loop_index], heights[loop.vertex_index])

    mesh.update()
    seam_faces = sum(
        1 for polygon in mesh.polygons
        if max(angles[mesh.loops[i].vertex_index] for i in polygon.loop_indices)
        - min(angles[mesh.loops[i].vertex_index] for i in polygon.loop_indices) > 0.5
    )
    return vertical_axis, seam_faces


def main() -> None:
    imported = import_model(INPUT_GLB)
    body = find_print_body(imported)
    vertical_axis, seam_faces = rebuild_cylindrical_uv(body)

    # Export only the objects imported from the source GLB. This avoids adding
    # unrelated objects that may already be open in the current Blender file.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in imported:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = body

    OUTPUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        use_selection=True,
    )

    axis_name = "XYZ"[vertical_axis]
    print("\nUV cilíndricas generadas.")
    print(f"Malla imprimible: {body.name}")
    print(f"Eje vertical detectado: {axis_name}")
    print(f"Caras que cruzan la costura UV: {seam_faces}")
    print(f"Modelo original: {INPUT_GLB}")
    print(f"Copia exportada: {OUTPUT_GLB}\n")


if __name__ == "__main__":
    main()
