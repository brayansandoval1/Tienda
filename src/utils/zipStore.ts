/** Crea un ZIP sin compresión, útil para empaquetar PNG grandes sin recodificarlos. */
export async function createStoredZip(files: Array<{ name: string; data: Blob }>): Promise<Blob> {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const directory: Array<{ bytes: ArrayBuffer; length: number }> = [];
  let offset = 0;

  const crcTable = new Uint32Array(256);
  for (let index = 0; index < crcTable.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    crcTable[index] = value >>> 0;
  }
  const crc32 = async (blob: Blob) => {
    let crc = 0xffffffff;
    const reader = blob.stream().getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const byte of value) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
      }
    } finally {
      reader.releaseLock();
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const header = (length: number, write: (view: DataView) => void) => {
    const bytes = new Uint8Array(length);
    write(new DataView(bytes.buffer));
    return bytes;
  };

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = await crc32(file.data);
    const local = header(30 + name.length, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(12, 0x0021, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, file.data.size, true);
      view.setUint32(22, file.data.size, true);
      view.setUint16(26, name.length, true);
    });
    local.set(name, 30);
    parts.push(local, file.data);

    const entry = header(46 + name.length, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0x0021, true);
      view.setUint32(16, crc, true);
      view.setUint32(20, file.data.size, true);
      view.setUint32(24, file.data.size, true);
      view.setUint16(28, name.length, true);
      view.setUint32(42, offset, true);
    });
    entry.set(name, 46);
    directory.push({ bytes: entry.buffer as ArrayBuffer, length: entry.length });
    offset += local.length + file.data.size;
  }

  const centralOffset = offset;
  const centralSize = directory.reduce((sum, entry) => sum + entry.length, 0);
  parts.push(...directory.map((entry) => entry.bytes));
  parts.push(header(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
  }));
  return new Blob(parts, { type: 'application/zip' });
}
