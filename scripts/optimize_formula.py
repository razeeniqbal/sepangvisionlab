"""Build a texture-free runtime copy; never rewrite the source GLB.
Asset-specific, lossless buffer-view repacking. Fail on unexpected extensions.
"""
from pathlib import Path
import copy, hashlib, json, struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/assets/models/cars/svl-formula-car-v1.glb'
TARGET = SOURCE.with_name('svl-formula-car-runtime-v1.glb')

def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    assert magic == 0x46546c67 and version == 2 and length == len(raw)
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    data = json.loads(raw[20:20+size])
    offset = 20 + size
    size, kind = struct.unpack_from('<II', raw, offset)
    assert kind == 0x004e4942
    return data, raw[offset+8:offset+8+size]

def build():
    before_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    original, binary = read_glb(SOURCE)
    data = copy.deepcopy(original)
    assert len(data['buffers']) == 1 and not data.get('animations') and not data.get('skins')
    assert set(data.get('extensionsUsed', [])) <= {'KHR_materials_specular'}
    assert not data.get('extensionsRequired')
    keep = set()
    for accessor in data['accessors']:
        assert not accessor.get('sparse') and not accessor.get('extensions')
        keep.add(accessor['bufferView'])
    output = bytearray(); views = []; mapping = {}
    for index in sorted(keep):
        view = copy.deepcopy(data['bufferViews'][index])
        assert view['buffer'] == 0 and not view.get('extensions')
        while len(output) % 4: output.append(0)
        start = view.get('byteOffset', 0)
        chunk = binary[start:start+view['byteLength']]
        assert len(chunk) == view['byteLength']
        view['byteOffset'] = len(output)
        output.extend(chunk)
        mapping[index] = len(views); views.append(view)
    for accessor in data['accessors']: accessor['bufferView'] = mapping[accessor['bufferView']]
    data['bufferViews'] = views
    data['buffers'] = [{'byteLength': len(output)}]
    for mesh in data['meshes']:
        for primitive in mesh['primitives']:
            assert not primitive.get('extensions')
            primitive.pop('material', None)
    for key in ['materials', 'textures', 'images', 'samplers', 'extensionsUsed', 'extensionsRequired']:
        data.pop(key, None)
    encoded = json.dumps(data,separators=(',',':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    output += b'\0' * (-len(output) % 4)
    glb = struct.pack('<III', 0x46546c67, 2, 28+len(encoded)+len(output))
    glb += struct.pack('<II',len(encoded),0x4e4f534a)+encoded
    glb += struct.pack('<II',len(output),0x004e4942)+output
    TARGET.write_bytes(glb)
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == before_hash
    print(json.dumps({'sourceBytes':SOURCE.stat().st_size,'runtimeBytes':len(glb),'sourceSha256':before_hash}))

if __name__ == '__main__': build()
