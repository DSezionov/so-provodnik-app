import { createHashRouter } from "react-router";

import { AboutPage } from "../features/about/AboutPage";
import { CatalogPage } from "../features/catalog/CatalogPage";
import { ChecklistPage } from "../features/checklist/ChecklistPage";
import { JournalPage } from "../features/journal/JournalPage";
import { QuestPage } from "../features/quest/QuestPage";
import { RoutePage } from "../features/route/RoutePage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { Layout } from "./Layout";
import { NotFoundPage } from "./NotFoundPage";
import { RouteError } from "./RouteError";

// Hash routing: GitHub Pages has no SPA fallback, and the app lives under a sub-path.
export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <JournalPage /> },
      { path: "route", element: <RoutePage /> },
      { path: "checklist", element: <ChecklistPage /> },
      { path: "catalog", element: <CatalogPage /> },
      { path: "quest/:id", element: <QuestPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "about", element: <AboutPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
