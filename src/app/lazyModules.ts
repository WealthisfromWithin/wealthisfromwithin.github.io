import { lazy } from 'react';

/**
 * Module chunks. Every module except the landing brief loads on demand (TD-16),
 * and they live in their own file so the router stays a route table.
 */
export const AiWorkspacePage = lazy(() =>
  import('@/modules/ai/AiWorkspacePage').then((m) => ({ default: m.AiWorkspacePage })),
);
export const AnalyticsPage = lazy(() =>
  import('@/modules/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
export const ApprovalsPage = lazy(() =>
  import('@/modules/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
);
export const AutomationRulePage = lazy(() =>
  import('@/modules/automations/AutomationRulePage').then((m) => ({
    default: m.AutomationRulePage,
  })),
);
export const AutomationsPage = lazy(() =>
  import('@/modules/automations/AutomationsPage').then((m) => ({ default: m.AutomationsPage })),
);
export const CalendarPage = lazy(() =>
  import('@/modules/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
export const CompanyDetailPage = lazy(() =>
  import('@/modules/crm/CrmDetailPage').then((m) => ({ default: m.CompanyDetailPage })),
);
export const ContentPage = lazy(() =>
  import('@/modules/content/ContentPage').then((m) => ({ default: m.ContentPage })),
);
export const ContentAnalyticsPage = lazy(() =>
  import('@/modules/content/ContentAnalyticsPage').then((m) => ({
    default: m.ContentAnalyticsPage,
  })),
);
export const ContentCalendarPage = lazy(() =>
  import('@/modules/content/ContentCalendarPage').then((m) => ({ default: m.ContentCalendarPage })),
);
export const ContentCampaignsPage = lazy(() =>
  import('@/modules/content/ContentCampaignsPage').then((m) => ({
    default: m.ContentCampaignsPage,
  })),
);
export const ContentIdeasPage = lazy(() =>
  import('@/modules/content/ContentIdeasPage').then((m) => ({ default: m.ContentIdeasPage })),
);
export const ContentItemPage = lazy(() =>
  import('@/modules/content/ContentItemPage').then((m) => ({ default: m.ContentItemPage })),
);
export const ContentLibraryPage = lazy(() =>
  import('@/modules/content/ContentLibraryPage').then((m) => ({ default: m.ContentLibraryPage })),
);
export const CrmPage = lazy(() =>
  import('@/modules/crm/CrmPage').then((m) => ({ default: m.CrmPage })),
);
export const DecisionPage = lazy(() =>
  import('@/modules/decisions/DecisionPage').then((m) => ({ default: m.DecisionPage })),
);
export const DecisionsPage = lazy(() =>
  import('@/modules/decisions/DecisionsPage').then((m) => ({ default: m.DecisionsPage })),
);
export const DocumentPage = lazy(() =>
  import('@/modules/documents/DocumentPage').then((m) => ({ default: m.DocumentPage })),
);
export const DocumentsPage = lazy(() =>
  import('@/modules/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
export const HealthPage = lazy(() =>
  import('@/modules/health/HealthPage').then((m) => ({ default: m.HealthPage })),
);
export const InboxPage = lazy(() =>
  import('@/modules/inbox/InboxPage').then((m) => ({ default: m.InboxPage })),
);
export const IntegrationsPage = lazy(() =>
  import('@/modules/integrations/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })),
);
export const KnowledgeNodePage = lazy(() =>
  import('@/modules/knowledge/KnowledgeNodePage').then((m) => ({ default: m.KnowledgeNodePage })),
);
export const KnowledgePage = lazy(() =>
  import('@/modules/knowledge/KnowledgePage').then((m) => ({ default: m.KnowledgePage })),
);
export const MeetingsPage = lazy(() =>
  import('@/modules/meetings/MeetingsPage').then((m) => ({ default: m.MeetingsPage })),
);
export const McpPage = lazy(() =>
  import('@/modules/integrations/McpPage').then((m) => ({ default: m.McpPage })),
);
export const MemoryPage = lazy(() =>
  import('@/modules/memory/MemoryPage').then((m) => ({ default: m.MemoryPage })),
);
export const MetricsPage = lazy(() =>
  import('@/modules/metrics/MetricsPage').then((m) => ({ default: m.MetricsPage })),
);
export const MissionPage = lazy(() =>
  import('@/modules/missions/MissionPage').then((m) => ({ default: m.MissionPage })),
);
export const MissionsPage = lazy(() =>
  import('@/modules/missions/MissionsPage').then((m) => ({ default: m.MissionsPage })),
);
export const OpportunityDetailPage = lazy(() =>
  import('@/modules/pipeline/OpportunityDetailPage').then((m) => ({
    default: m.OpportunityDetailPage,
  })),
);
export const PersonDetailPage = lazy(() =>
  import('@/modules/crm/CrmDetailPage').then((m) => ({ default: m.PersonDetailPage })),
);
export const PipelinePage = lazy(() =>
  import('@/modules/pipeline/PipelinePage').then((m) => ({ default: m.PipelinePage })),
);
export const ProjectsPage = lazy(() =>
  import('@/modules/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
export const PromptsPage = lazy(() =>
  import('@/modules/prompts/PromptsPage').then((m) => ({ default: m.PromptsPage })),
);
export const ResearchPage = lazy(() =>
  import('@/modules/research/ResearchPage').then((m) => ({ default: m.ResearchPage })),
);
export const SettingsPage = lazy(() =>
  import('@/modules/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
export const SyncPage = lazy(() =>
  import('@/modules/sync/SyncPage').then((m) => ({ default: m.SyncPage })),
);
export const TasksPage = lazy(() =>
  import('@/modules/tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
);
