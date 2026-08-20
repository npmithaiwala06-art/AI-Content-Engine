import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ClientDetailPage } from "./pages/ClientDetailPage";
import { ClientsPage } from "./pages/ClientsPage";
import { AiWorkspacePage } from "./pages/AiWorkspacePage";
import { ContentImporterPage } from "./pages/ContentImporterPage";
import { ContentStudioPage } from "./pages/ContentStudioPage";
import { MediaLibraryPage } from "./pages/MediaLibraryPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { PublishingQueuePage } from "./pages/PublishingQueuePage";
import { SocialAccountsPage } from "./pages/SocialAccountsPage";
import { ScheduledPage } from "./pages/ScheduledPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { ContentPlansPage } from "./pages/ContentPlansPage";
import { ActivityPage } from "./pages/ActivityPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ReleaseReadinessPage } from "./pages/ReleaseReadinessPage";
import { ChatGptPage } from "./pages/ChatGptPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:clientId" element={<ClientDetailPage />} />
        <Route path="ai-workspace" element={<AiWorkspacePage />} />
        <Route path="ai-workspace/import" element={<ContentImporterPage />} />
        <Route path="chatgpt" element={<ChatGptPage />} />
        <Route path="create" element={<ContentStudioPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="plans" element={<ContentPlansPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="scheduled" element={<ScheduledPage />} />
        <Route path="publishing-queue" element={<PublishingQueuePage />} />
        <Route path="published" element={<PublishingQueuePage mode="published" />} />
        <Route path="media" element={<MediaLibraryPage />} />
        <Route path="accounts" element={<SocialAccountsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="readiness" element={<ReleaseReadinessPage />} />
      </Route>
    </Routes>
  );
}
