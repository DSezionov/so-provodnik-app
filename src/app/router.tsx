import { createHashRouter } from "react-router";

import { Layout } from "./Layout";
import { NotFoundPage } from "./NotFoundPage";
import { RouteError } from "./RouteError";

// Hash routing: GitHub Pages has no SPA fallback, and the app lives under a sub-path.
// Sections load lazily (own chunks); the service worker precaches all of them for offline use.
export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import("../features/journal/JournalPage")).JournalPage }) },
      { path: "route", lazy: async () => ({ Component: (await import("../features/route/RoutePage")).RoutePage }) },
      { path: "checklist", lazy: async () => ({ Component: (await import("../features/checklist/ChecklistPage")).ChecklistPage }) },
      { path: "catalog", lazy: async () => ({ Component: (await import("../features/catalog/CatalogPage")).CatalogPage }) },
      { path: "quest/:id", lazy: async () => ({ Component: (await import("../features/quest/QuestPage")).QuestPage }) },
      { path: "settings", lazy: async () => ({ Component: (await import("../features/settings/SettingsPage")).SettingsPage }) },
      { path: "about", lazy: async () => ({ Component: (await import("../features/about/AboutPage")).AboutPage }) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
