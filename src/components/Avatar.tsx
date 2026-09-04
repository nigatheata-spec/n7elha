import { cn } from "@/lib/utils";
import { resolveColor, resolveFace } from "@/lib/avatarIdentity";

const SIZES = { sm: 32, md: 40, lg: 64, xl: 96 } as const;

interface Props {
  name: string;
  size?: keyof typeof SIZES | number;
  className?: string;
  /** A student's stored choice, from game_students.avatar_color/avatar_face. Omit to fall back to the name hash. */
  colorIndex?: number | null;
  faceIndex?: number | null;
}

export const Avatar = ({ name, size = "md", className, colorIndex, faceIndex }: Props) => {
  const px = typeof size === "number" ? size : SIZES[size];
  const bg = resolveColor(name, colorIndex);
  const face = resolveFace(name, faceIndex);

  return (
    <div
      style={{ background: bg, width: px, height: px }}
      className={cn(
        "relative rounded-full shrink-0 select-none overflow-hidden border-2 border-[hsl(var(--nb-border))]",
        className,
      )}
    >
      {face && (
        <img
          src={face}
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 w-[128%] max-w-none -translate-x-1/2 -translate-y-1/2"
        />
      )}
    </div>
  );
};

export default Avatar;
