// ── Don't Look Down — pixel art roster ──────────────────────────────────────
// Every block is baked to the EXACT size it is drawn at, in buffer pixels, by
// a script run against the source art. Nothing is ever scaled at runtime: the
// renderer blits each image 1:1, so all art shares one pixel grid with the
// hand-drawn character, sky and ground. Change a size here and the PNG has to
// be re-baked to match, or that block stops lining up with the grid.
//
// `aff` is where a block belongs in its theme band:
//   ground — it grows from / rests on the floor (a tree, a truck, a bookshelf),
//            so it is placed in the lower part of its band
//   air    — it only makes sense off the ground (a satellite, a black hole)
//   any    — reads fine at any height

import schoolBookshelf from "@/assets/dld/school-bookshelf.png";
import schoolTree from "@/assets/dld/school-tree.png";
import schoolChalkboard from "@/assets/dld/school-chalkboard.png";
import schoolBucket from "@/assets/dld/school-bucket.png";
import schoolChair from "@/assets/dld/school-chair.png";
import beachSlab from "@/assets/dld/beach-slab.png";
import beachSand from "@/assets/dld/beach-sand.png";
import beachPalm from "@/assets/dld/beach-palm.png";
import beachCactus from "@/assets/dld/beach-cactus.png";
import beachRock from "@/assets/dld/beach-rock.png";
import beachPillar from "@/assets/dld/beach-pillar.png";
import beachPalmpot from "@/assets/dld/beach-palmpot.png";
import cityTruck from "@/assets/dld/city-truck.png";
import cityCar from "@/assets/dld/city-car.png";
import cityDumpster from "@/assets/dld/city-dumpster.png";
import cityBuilding from "@/assets/dld/city-building.png";
import cityRooftop from "@/assets/dld/city-rooftop.png";
import cityLamp from "@/assets/dld/city-lamp.png";
import spaceAsteroid from "@/assets/dld/space-asteroid.png";
import spaceStone from "@/assets/dld/space-stone.png";
import spaceColumn from "@/assets/dld/space-column.png";
import spaceSatellite from "@/assets/dld/space-satellite.png";
import spaceRocket from "@/assets/dld/space-rocket.png";
import spaceBlackhole from "@/assets/dld/space-blackhole.png";

export type Affinity = "ground" | "any" | "air";

export type BlockId =
  | "school-bookshelf"
  | "school-tree"
  | "school-chalkboard"
  | "school-bucket"
  | "school-chair"
  | "beach-slab"
  | "beach-sand"
  | "beach-palm"
  | "beach-cactus"
  | "beach-rock"
  | "beach-pillar"
  | "beach-palmpot"
  | "city-truck"
  | "city-car"
  | "city-dumpster"
  | "city-building"
  | "city-rooftop"
  | "city-lamp"
  | "space-asteroid"
  | "space-stone"
  | "space-column"
  | "space-satellite"
  | "space-rocket"
  | "space-blackhole"
  ;

export type Block = { src: string; w: number; h: number; aff: Affinity };

/** w/h are BUFFER PIXELS — the block's true drawn size. */
export const BLOCKS: Record<BlockId, Block> = {
  "school-bookshelf": { src: schoolBookshelf, w: 130, h: 46, aff: "ground" },
  "school-tree": { src: schoolTree, w: 41, h: 52, aff: "ground" },
  "school-chalkboard": { src: schoolChalkboard, w: 72, h: 46, aff: "any" },
  "school-bucket": { src: schoolBucket, w: 42, h: 46, aff: "any" },
  "school-chair": { src: schoolChair, w: 36, h: 52, aff: "any" },
  "beach-slab": { src: beachSlab, w: 130, h: 33, aff: "ground" },
  "beach-sand": { src: beachSand, w: 130, h: 43, aff: "ground" },
  "beach-palm": { src: beachPalm, w: 42, h: 52, aff: "ground" },
  "beach-cactus": { src: beachCactus, w: 42, h: 50, aff: "ground" },
  "beach-rock": { src: beachRock, w: 63, h: 52, aff: "any" },
  "beach-pillar": { src: beachPillar, w: 42, h: 47, aff: "any" },
  "beach-palmpot": { src: beachPalmpot, w: 40, h: 52, aff: "any" },
  "city-truck": { src: cityTruck, w: 130, h: 46, aff: "ground" },
  "city-car": { src: cityCar, w: 72, h: 30, aff: "ground" },
  "city-dumpster": { src: cityDumpster, w: 72, h: 50, aff: "ground" },
  "city-building": { src: cityBuilding, w: 37, h: 52, aff: "ground" },
  "city-rooftop": { src: cityRooftop, w: 72, h: 42, aff: "any" },
  "city-lamp": { src: cityLamp, w: 33, h: 70, aff: "any" },
  "space-asteroid": { src: spaceAsteroid, w: 72, h: 38, aff: "any" },
  "space-stone": { src: spaceStone, w: 72, h: 50, aff: "any" },
  "space-column": { src: spaceColumn, w: 32, h: 70, aff: "any" },
  "space-satellite": { src: spaceSatellite, w: 72, h: 48, aff: "air" },
  "space-rocket": { src: spaceRocket, w: 36, h: 70, aff: "air" },
  "space-blackhole": { src: spaceBlackhole, w: 130, h: 49, aff: "air" },
};

export type ThemeId = "school" | "beach" | "city" | "space";

export const THEME_BLOCKS: Record<ThemeId, BlockId[]> = {
  school: ["school-bookshelf", "school-tree", "school-chalkboard", "school-bucket", "school-chair"],
  beach: ["beach-slab", "beach-sand", "beach-palm", "beach-cactus", "beach-rock", "beach-pillar", "beach-palmpot"],
  city: ["city-truck", "city-car", "city-dumpster", "city-building", "city-rooftop", "city-lamp"],
  space: ["space-asteroid", "space-stone", "space-column", "space-satellite", "space-rocket", "space-blackhole"],
};
