// Lista de familias que ofrece el selector "Fuente" de la barra de texto.
// Antes era un arreglo fijo de 10 nombres; ahora se deriva del catálogo
// completo (unas 60 familias en lib/googleFontLibrary.ts) agrupando por
// estilo, de modo que agregar una entrada allí la hace aparecer aquí y en la
// galería del sidebar sin tocar ningún otro archivo.

import { FONT_LIBRARY } from './googleFontLibrary';

export const GOOGLE_FONTS: string[] = FONT_LIBRARY.map((font) => font.family);
