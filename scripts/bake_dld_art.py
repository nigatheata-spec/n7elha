#!/usr/bin/env python3
"""Bake Don't Look Down art onto the game's pixel grid.

The renderer blits every sprite 1:1 into a small pixel buffer that the browser
upscales with nearest-neighbour, so nothing may be scaled at runtime — a sprite
drawn at anything other than its baked size stops sharing the pixel grid with
the character, sky and ground, and the whole scene goes soft.

So sizing happens here, once, and the result is written into a generated
manifest the game reads. Re-run this after changing the source art:

    python3 scripts/bake_dld_art.py "~/Downloads/claude assets down"

Source art is grouped by folder: `blocks` are the standing surfaces, every
other folder is a themed prop set. Names below are in sheet order.
"""
import json, os, sys, glob
from PIL import Image

SRC = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads/claude assets down")
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "dld")
MANIFEST = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "dldArtManifest.ts")

# ── Names, in sheet order ────────────────────────────────────────────────────
BLOCKS = [
    # cubes (square-ish, ~93x76 source)
    "stone", "mossy", "crate", "brick", "sand", "ice", "grass", "checker",
    "metal", "ember", "lava", "dirt", "clay", "candy", "amethyst", "concrete",
    "orchid", "snow", "mud", "count", "slime", "pool", "cobble", "rust", "tally",
    # planks (~118-177 x 62)
    "wood", "gravel", "mossbrick", "sandstone", "tile", "stonewall", "greystone",
    "mossyledge", "rubble", "panel",
    # slabs (~108-164 x 36)
    "stoneslab", "mossslab", "dirtslab", "paleslab", "plankslab",
    # planks (~121-177 x 61)
    "darkwood", "pebble", "mossblock", "rockledge", "grassledge", "walnut",
    "greybrick", "sandledge", "mossledge", "greyledge", "woodplank",
    "mossbrick2", "brownbrick", "palebrick", "stonepair",
]
PROPS = {
    "school": ["pencil", "eraser", "notebook", "backpack", "openbook", "scissors",
               "glue", "calculator", "ruler", "bookstack", "protractor", "pencilcase",
               "crayons", "goggles", "globe", "desklamp", "composition", "lunchbag",
               "notepad", "chalk", "marker", "paintbrush", "lunchbox", "locker"],
    "farm": ["apple", "wateringcan", "bucket", "seedsack", "fence", "trowel",
             "haybales", "carrot", "potato", "pumpkin", "tomato", "pitchfork",
             "axe", "coop", "chicken", "eggbasket", "fertilizer", "strawberry",
             "cabbage", "sunflower", "scarecrow", "rope", "tractor", "beehive",
             "milkcan", "logs"],
    "desert": ["shard", "boulder", "snake", "scorpion", "urn", "compass",
               "spyglass", "coins", "cactus", "rocks", "scroll", "chest",
               "canteen", "boot", "column", "arrow", "lizard", "lantern",
               "books", "stoneblock", "tumbleweed", "frond", "skull", "bone",
               "hourglass"],
    "aqua": ["idol", "anchor", "coral", "turtle", "chest", "jellyfish",
             "clownfish", "conch", "starfish", "seagrass", "anglerfish", "crab",
             "sardines", "divehelmet", "urchin", "bottle", "stingray", "clam",
             "net", "seahorse", "fossil", "ghostsquid", "cave", "reeffish",
             "bubbles"],
    "city": ["trafficlight", "trashcan", "mailbox", "bikerack", "bench",
             "stopsign", "onewaysign", "phonebooth", "puddle", "manhole",
             "parkingmeter", "newsstand", "fountain", "cone", "barrier",
             "treegrate", "busstop", "streetlamp", "hedge", "pigeon", "scooter",
             "vending", "callbox"],
    "space": ["fighter", "galaxy", "satellite", "asteroid", "saturn", "probe",
              "lander", "moon", "portal", "jupiter", "rocket", "dome", "debris",
              "redplanet", "cruiser", "vortex", "rover", "ufo", "helmet",
              "station", "comet", "blackhole", "telescope"],
}

# Baked heights, in buffer pixels. One height per family keeps a family reading
# as a set, and lets the level pick a platform purely by the width that falls
# out of each sprite's own aspect ratio.
CUBE_H, PLANK_H, SLAB_H = 40, 30, 26
PROP_MAX_H, PROP_MAX_W = 44, 60


def family_of(src_w, src_h):
    """Which block family a source sprite belongs to, from its raw proportions."""
    if src_h > 70:
        return "cube"
    return "plank" if src_h > 50 else "slab"


def load(path):
    im = Image.open(path).convert("RGBA")
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def bake(im, w, h):
    return im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)


def standable(im):
    """Whether a prop reads as something you could land on.

    The player's feet land on the sprite's top edge, so a prop works as a
    platform when that edge is solid: broad and solid for a bench or a hay
    bale, or narrow but flat-topped for a stop sign or a parking meter, which
    make the tiny perches the hardest stages are built from. Spindly art with
    no top at all — a net, a pitchfork, an arrow — stays out.
    """
    w, h = im.size
    a = im.split()[-1]
    band = a.crop((int(w * 0.15), 0, int(w * 0.85), max(1, int(h * 0.22))))
    px = list(band.getdata())
    cov = sum(1 for p in px if p > 128) / max(1, len(px))
    return cov >= 0.35 or (w >= h * 0.5 and cov >= 0.18)


entries = {}
os.makedirs(OUT, exist_ok=True)
for old in glob.glob(os.path.join(OUT, "*.png")):
    os.remove(old)

# Blocks
files = sorted(glob.glob(os.path.join(SRC, "blocks", "*.png")))
assert len(files) == len(BLOCKS), f"blocks: {len(files)} files vs {len(BLOCKS)} names"
for name, f in zip(BLOCKS, files):
    im = load(f)
    fam = family_of(*im.size)
    th = {"cube": CUBE_H, "plank": PLANK_H, "slab": SLAB_H}[fam]
    im2 = bake(im, im.width * th / im.height, th)
    key = f"block-{fam}-{name}"
    im2.save(os.path.join(OUT, key + ".png"))
    entries[key] = dict(w=im2.width, h=im2.height, kind="block", family=fam, theme="any", stand=True)

# Props
for theme, names in PROPS.items():
    files = sorted(glob.glob(os.path.join(SRC, theme, "*.png")))
    assert len(files) == len(names), f"{theme}: {len(files)} files vs {len(names)} names"
    for name, f in zip(names, files):
        im = load(f)
        s = min(PROP_MAX_H / im.height, PROP_MAX_W / im.width)
        im2 = bake(im, im.width * s, im.height * s)
        key = f"{theme}-{name}"
        im2.save(os.path.join(OUT, key + ".png"))
        entries[key] = dict(w=im2.width, h=im2.height, kind="prop", family="prop",
                            theme=theme, stand=standable(im2))

rows = "\n".join(
    f'  "{k}": {{ w: {v["w"]}, h: {v["h"]}, kind: "{v["kind"]}", family: "{v["family"]}", '
    f'theme: "{v["theme"]}", stand: {str(v["stand"]).lower()} }},'
    for k, v in sorted(entries.items()))
with open(MANIFEST, "w") as fh:
    fh.write(
        "// GENERATED by scripts/bake_dld_art.py — do not edit by hand.\n"
        "// w/h are BUFFER PIXELS: the exact size the renderer blits each sprite at.\n\n"
        "export type ArtFamily = \"cube\" | \"plank\" | \"slab\" | \"prop\";\n"
        "export type ArtTheme = \"any\" | \"school\" | \"aqua\" | \"farm\" | \"desert\" | \"city\" | \"space\";\n"
        "export type ArtEntry = {\n  w: number;\n  h: number;\n  kind: \"block\" | \"prop\";\n"
        "  family: ArtFamily;\n  theme: ArtTheme;\n  /** Broad, solid top edge — reads as something you can land on. */\n  stand: boolean;\n};\n\n"
        "export const ART = {\n" + rows + "\n} as const satisfies Record<string, ArtEntry>;\n\n"
        "export type ArtId = keyof typeof ART;\n")

stand = sum(1 for v in entries.values() if v["kind"] == "prop" and v["stand"])
print(f"baked {len(entries)} sprites — {stand} props standable")
