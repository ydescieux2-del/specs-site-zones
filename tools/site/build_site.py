"""Build the stand-in job site for Site Zones: the ground floor of a high-rise under construction.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python tools/site/build_site.py -- Assets/Site/JobSite.glb [preview.png]

Units are meters in Blender (Lens Studio imports glTF meters as 100 cm).
The wearer starts at the origin beside his truck and walks toward +Y (glTF -Z).
Colors are kept light: the Specs display is additive, so dark surfaces vanish.
Layout constants below are the single source for the Lens scripts too (see LAYOUT).
"""
import math
import sys

import bpy

# ---- layout (meters, x right, y forward from the truck) --------------------
SLAB = dict(x0=-11.0, x1=15.0, y0=-5.0, y1=23.0, thick=0.3)
GAPS = [dict(x=-4.0, y=9.0, w=2.2, d=2.2), dict(x=3.2, y=14.0, w=1.6, d=3.0)]
CRANE = dict(x=9.0, y=11.0, swing_r=5.0)
TRUCK = dict(x=-3.2, y=-0.5)
WORK = dict(x=-2.0, y=18.0)
PATH = [(0.0, 0.5), (0.0, 6.5), (0.6, 10.5), (-0.6, 14.5), (-2.0, 17.2)]
COLS = [(x, y) for x in (-9, -3, 3, 9) for y in (3, 9, 15, 21)]
LEVEL = 3.6  # floor to floor


def mat(name, rgb, rough=0.8, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


M = {}


def box(name, cx, cy, cz, sx, sy, sz, m, rot_z=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz), rotation=(0, 0, rot_z))
    o = bpy.context.object
    o.name = name
    o.scale = (sx, sy, sz)
    o.data.materials.append(M[m])
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def cyl(name, cx, cy, cz, r, h, m, rot=(0, 0, 0), verts=20, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(cx, cy, cz), rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(M[m])
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def empty(name, loc):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    bpy.context.collection.objects.link(o)
    return o


def slab_with_gaps():
    """Slab built as strips so the gaps are real openings down to a lower level."""
    s = SLAB
    t = s["thick"]
    xs = sorted({s["x0"], s["x1"]} | {g["x"] - g["w"] / 2 for g in GAPS} | {g["x"] + g["w"] / 2 for g in GAPS})
    ys = sorted({s["y0"], s["y1"]} | {g["y"] - g["d"] / 2 for g in GAPS} | {g["y"] + g["d"] / 2 for g in GAPS})

    def in_gap(cx, cy):
        return any(abs(cx - g["x"]) < g["w"] / 2 and abs(cy - g["y"]) < g["d"] / 2 for g in GAPS)

    n = 0
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
            if in_gap(cx, cy):
                continue
            box(f"Slab_{n}", cx, cy, -t / 2 + 0.005, xs[i + 1] - xs[i], ys[j + 1] - ys[j], t, "concrete")
            n += 1
    for k, g in enumerate(GAPS):
        # lower level seen through the opening, and the raw slab edge
        box(f"Gap{k}_Lower", g["x"], g["y"], -LEVEL, g["w"] + 3, g["d"] + 3, 0.1, "lower")
        for dx, dy, sx, sy in ((0, g["d"] / 2, g["w"], 0.06), (0, -g["d"] / 2, g["w"], 0.06),
                               (g["w"] / 2, 0, 0.06, g["d"]), (-g["w"] / 2, 0, 0.06, g["d"])):
            box(f"Gap{k}_Edge", g["x"] + dx, g["y"] + dy, -t / 2, sx, sy, t, "edge")
        for r in range(4):  # rebar stubs
            box(f"Gap{k}_Rebar", g["x"] - g["w"] / 2 + 0.3 + r * 0.45, g["y"] + g["d"] / 2 - 0.12, -0.1, 0.03, 0.3, 0.03, "rebar")


def structure():
    s = SLAB
    for i, (x, y) in enumerate(COLS):
        if any(abs(x - g["x"]) < 1.5 and abs(y - g["y"]) < 2 for g in GAPS):
            continue
        if math.hypot(x - CRANE["x"], y - CRANE["y"]) < 3.5:
            continue
        box(f"Column_{i}", x, y, LEVEL / 2, 0.6, 0.6, LEVEL, "column")
    # deck above, only over the back half so the truck end reads as open air
    box("Deck", (s["x0"] + s["x1"]) / 2 - 4, 15, LEVEL + 0.15, s["x1"] - s["x0"] - 8, 16, 0.3, "deck")
    # back wall with the electrician's panel
    box("BackWall", -2, s["y1"] - 0.1, LEVEL / 2, 14, 0.2, LEVEL, "wall")
    box("Panel", WORK["x"], WORK["y"] + 1.35, 1.5, 0.9, 0.18, 1.2, "panel")
    box("PanelDoor", WORK["x"], WORK["y"] + 1.25, 1.5, 0.8, 0.02, 1.1, "paneldoor")
    for k in range(3):
        cyl(f"Conduit_{k}", WORK["x"] - 0.3 + k * 0.3, WORK["y"] + 1.38, 2.85, 0.025, 1.5, "steel")
    # perimeter guard posts and rails on the open side
    for k in range(14):
        y = s["y0"] + 1 + k * 2
        box(f"Post_{k}", s["x0"] + 0.2, y, 0.55, 0.05, 0.05, 1.1, "yellow")
    box("RailTop", s["x0"] + 0.2, (s["y0"] + s["y1"]) / 2, 1.07, 0.04, s["y1"] - s["y0"] - 2, 0.04, "yellow")
    box("RailMid", s["x0"] + 0.2, (s["y0"] + s["y1"]) / 2, 0.55, 0.04, s["y1"] - s["y0"] - 2, 0.04, "yellow")
    # site clutter
    for k, (x, y) in enumerate(((5.5, 3.5), (6.3, 3.9), (-7.5, 14.0))):
        box(f"Pallet_{k}", x, y, 0.07, 1.2, 1.0, 0.14, "wood")
        box(f"Blocks_{k}", x, y, 0.5, 1.0, 0.8, 0.7, "block")
    for k in range(5):
        cyl(f"Pipe_{k}", -7.5 + (k % 3) * 0.17, 5.0, 0.09 + (k // 3) * 0.16, 0.08, 4.0, "steel", rot=(math.pi / 2, 0, 0), verts=12)
    for k, (x, y) in enumerate(((1.6, 2.0), (-1.6, 2.0), (2.0, 19.5))):
        cyl(f"ConeBase_{k}", x, y, 0.02, 0.2, 0.04, "orange", verts=4)
        bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.14, radius2=0.03, depth=0.6, location=(x, y, 0.34))
        c = bpy.context.object
        c.name = f"Cone_{k}"
        c.data.materials.append(M["orange"])


def truck():
    x, y = TRUCK["x"], TRUCK["y"]
    root = empty("Truck", (x, y, 0))
    box("TruckBed", x, y - 1.3, 0.85, 1.9, 2.4, 0.5, "white", parent=root)
    box("TruckCab", x, y + 0.7, 1.15, 1.9, 1.6, 1.1, "white", parent=root)
    box("TruckHood", x, y + 2.0, 0.85, 1.9, 1.1, 0.5, "white", parent=root)
    box("TruckGlass", x, y + 1.42, 1.4, 1.7, 0.2, 0.5, "glass", parent=root)
    box("LadderRack", x, y - 0.6, 1.75, 1.6, 3.4, 0.06, "steel", parent=root)
    box("Ladder", x + 0.4, y - 0.6, 1.83, 0.4, 3.2, 0.08, "yellow", parent=root)
    for wx in (-0.95, 0.95):
        for wy in (-1.6, 1.7):
            cyl("Wheel", x + wx, y + wy, 0.38, 0.38, 0.28, "tire", rot=(0, math.pi / 2, 0), parent=root)


def crane():
    x, y = CRANE["x"], CRANE["y"]
    base = empty("CraneBase", (x, y, 0))
    box("CraneTracksL", x - 1.3, y, 0.4, 0.7, 4.6, 0.8, "tire", parent=base)
    box("CraneTracksR", x + 1.3, y, 0.4, 0.7, 4.6, 0.8, "tire", parent=base)
    box("CraneCarbody", x, y, 0.75, 2.2, 2.6, 0.5, "steel", parent=base)
    cyl("CraneRing", x, y, 1.05, 1.0, 0.15, "steel", parent=base)
    # the rotating superstructure: the Lens animates this object around its Z axis
    upper = empty("CraneUpper", (x, y, 1.15))
    box("CraneHouse", x, y - 0.6, 1.95, 2.6, 4.2, 1.5, "craneyellow", parent=upper)
    box("CraneCounterweight", x, y - 3.2, 1.7, 2.8, 1.2, 1.4, "counter", parent=upper)
    box("CraneCab", x - 0.85, y + 1.3, 2.1, 0.9, 1.4, 1.4, "glass", parent=upper)
    boom_len, ang = 16.0, math.radians(58)
    by, bz = y + 1.5 + math.cos(ang) * boom_len / 2, 1.8 + math.sin(ang) * boom_len / 2
    b = box("CraneBoom", x + 0.3, by, bz, 0.5, boom_len, 0.5, "craneyellow", parent=upper)
    b.rotation_euler = (ang, 0, 0)
    tip_y, tip_z = y + 1.5 + math.cos(ang) * boom_len, 1.8 + math.sin(ang) * boom_len
    cyl("CraneCable", x + 0.3, tip_y, tip_z - 3.5, 0.02, 7.0, "steel", verts=8, parent=upper)
    box("CraneHook", x + 0.3, tip_y, tip_z - 7.2, 0.3, 0.3, 0.5, "orange", parent=upper)
    box("CraneLoad", x + 0.3, tip_y, tip_z - 8.2, 2.4, 0.4, 0.4, "steel", parent=upper)
    for sx in (-1.25, 1.25):  # hazard stripes on the tail, the part that sweeps people
        box("CraneStripe", x + sx * 1.13, y - 3.2, 1.7, 0.03, 1.2, 0.5, "orange", parent=upper)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name, rgb, kw in (
        ("concrete", (0.72, 0.71, 0.68), {}), ("lower", (0.42, 0.44, 0.48), {}), ("edge", (0.85, 0.52, 0.2), {}),
        ("rebar", (0.75, 0.38, 0.2), dict(metal=0.6)), ("column", (0.78, 0.77, 0.74), {}), ("deck", (0.66, 0.66, 0.66), {}),
        ("wall", (0.82, 0.8, 0.76), {}), ("panel", (0.62, 0.66, 0.7), dict(metal=0.5, rough=0.5)),
        ("paneldoor", (0.75, 0.79, 0.83), dict(metal=0.5, rough=0.4)), ("steel", (0.7, 0.72, 0.75), dict(metal=0.7, rough=0.45)),
        ("yellow", (0.98, 0.8, 0.1), {}), ("craneyellow", (0.98, 0.74, 0.08), dict(rough=0.5)),
        ("counter", (0.55, 0.56, 0.6), {}), ("orange", (1.0, 0.42, 0.05), {}), ("white", (0.93, 0.94, 0.95), dict(rough=0.4)),
        ("glass", (0.55, 0.75, 0.9), dict(rough=0.1, metal=0.3)), ("tire", (0.3, 0.31, 0.33), {}),
        ("wood", (0.74, 0.58, 0.38), {}), ("block", (0.68, 0.68, 0.7), {}),
    ):
        M[name] = mat(name, rgb, **kw)
    slab_with_gaps()
    structure()
    truck()
    crane()


def render_preview(path):
    scn = bpy.context.scene
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 30), rotation=(math.radians(50), 0, math.radians(35)))
    bpy.context.object.data.energy = 4.0
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.78, 0.95, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    scn.view_settings.view_transform = "Standard"
    scn.world = world
    bpy.ops.object.camera_add(location=(-9, -13, 7.5))
    cam = bpy.context.object
    target = empty("CamTarget", (2, 9, 1))
    c = cam.constraints.new("TRACK_TO")
    c.target = target
    cam.data.lens = 28
    scn.camera = cam
    scn.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    scn.render.resolution_x, scn.render.resolution_y = 1600, 900
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in (cam, target):
        bpy.data.objects.remove(o)
    for o in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(o)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = args[0] if args else "Assets/Site/JobSite.glb"
    build()
    if len(args) > 1:
        render_preview(args[1])
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_yup=True, export_apply=True)
    print("wrote", out)
