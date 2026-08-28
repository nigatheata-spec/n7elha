import { Loader2 } from "lucide-react";

// Suspense fallback while a route's lazy chunk downloads. Full-viewport so it
// never renders inside a route's own layout (sidebar, header) and shifts it.
export const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#EBDFC7" }}>
    <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#3F5A63" }} />
  </div>
);
