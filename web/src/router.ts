import { useEffect, useState } from "react";

/**
 * Deliberately not react-router: six top-level views plus a couple of
 * detail panels don't need a routing library. Hash-based so the static
 * build (no server-side route handling required) just works.
 */
export type Route =
  | { name: "overview" }
  | { name: "test-runs" }
  | { name: "self-healing"; scenarioId?: string }
  | { name: "visual-diff" }
  | { name: "reports" }
  | { name: "artifacts" };

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [segment, param] = path.split("/");

  switch (segment) {
    case "test-runs":
      return { name: "test-runs" };
    case "self-healing":
      return { name: "self-healing", scenarioId: param };
    case "visual-diff":
      return { name: "visual-diff" };
    case "reports":
      return { name: "reports" };
    case "artifacts":
      return { name: "artifacts" };
    default:
      return { name: "overview" };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case "overview":
      return "#/";
    case "self-healing":
      return route.scenarioId ? `#/self-healing/${route.scenarioId}` : "#/self-healing";
    default:
      return `#/${route.name}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}
