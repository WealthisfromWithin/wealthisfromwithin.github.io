import { Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import { enabledModules, enabledRecordRoutes, enabledSubRoutes } from './modules';
import { MorningBriefPage } from '@/modules/dashboard/MorningBriefPage';
import {
  AiWorkspacePage,
  AnalyticsPage,
  ApprovalsPage,
  AutomationRulePage,
  AutomationsPage,
  CalendarPage,
  CompanyDetailPage,
  ContentAnalyticsPage,
  ContentCalendarPage,
  ContentCampaignsPage,
  ContentIdeasPage,
  ContentItemPage,
  ContentLibraryPage,
  ContentPage,
  CrmPage,
  DecisionPage,
  DecisionsPage,
  DocumentPage,
  DocumentsPage,
  HealthPage,
  InboxPage,
  IntegrationsPage,
  KnowledgeNodePage,
  KnowledgePage,
  McpPage,
  MeetingsPage,
  MemoryPage,
  MetricsPage,
  MissionPage,
  MissionsPage,
  OpportunityDetailPage,
  PersonDetailPage,
  PipelinePage,
  ProjectsPage,
  PromptsPage,
  ResearchPage,
  SettingsPage,
  SyncPage,
  TasksPage,
} from './lazyModules';

/**
 * Only enabled modules get a route. A planned module resolves to the brief
 * instead of a "coming soon" page, so the nav and the router agree on what
 * exists (ARCHITECTURE_AUDIT §5.3).
 */
const moduleElements: Record<string, RouteObject['element']> = {
  brief: <MorningBriefPage />,
  approvals: <ApprovalsPage />,
  health: <HealthPage />,
  inbox: <InboxPage />,
  crm: <CrmPage />,
  pipeline: <PipelinePage />,
  tasks: <TasksPage />,
  projects: <ProjectsPage />,
  calendar: <CalendarPage />,
  meetings: <MeetingsPage />,
  content: <ContentPage />,
  decisions: <DecisionsPage />,
  knowledge: <KnowledgePage />,
  memory: <MemoryPage />,
  documents: <DocumentsPage />,
  research: <ResearchPage />,
  ai: <AiWorkspacePage />,
  prompts: <PromptsPage />,
  missions: <MissionsPage />,
  metrics: <MetricsPage />,
  automations: <AutomationsPage />,
  analytics: <AnalyticsPage />,
  integrations: <IntegrationsPage />,
  sync: <SyncPage />,
  settings: <SettingsPage />,
};

/** Keyed by the sub-route id declared in the registry. */
const subRouteElements: Record<string, RouteObject['element']> = {
  'content-ideas': <ContentIdeasPage />,
  'content-calendar': <ContentCalendarPage />,
  'content-campaigns': <ContentCampaignsPage />,
  'content-library': <ContentLibraryPage />,
  'content-analytics': <ContentAnalyticsPage />,
  'integrations-mcp': <McpPage />,
};

/** Keyed by the record-route id declared in the registry. */
const recordElements: Record<string, RouteObject['element']> = {
  'crm-person': <PersonDetailPage />,
  'crm-company': <CompanyDetailPage />,
  'pipeline-opportunity': <OpportunityDetailPage />,
  'content-item': <ContentItemPage />,
  'knowledge-node': <KnowledgeNodePage />,
  document: <DocumentPage />,
  decision: <DecisionPage />,
  'automation-rule': <AutomationRulePage />,
  mission: <MissionPage />,
};

function buildModuleRoutes(): RouteObject[] {
  return enabledModules().flatMap((module) => {
    const element = moduleElements[module.id];
    if (!element) return [];
    return [
      module.path === '/'
        ? { index: true, element }
        : { path: module.path.replace(/^\//, ''), element },
    ];
  });
}

function buildSubRoutes(): RouteObject[] {
  return enabledSubRoutes().flatMap((route) => {
    const element = subRouteElements[route.id];
    if (!element) return [];
    return [{ path: route.path.replace(/^\//, ''), element }];
  });
}

function buildRecordRoutes(): RouteObject[] {
  return enabledRecordRoutes().flatMap((record) => {
    const element = recordElements[record.id];
    if (!element) return [];
    return [{ path: record.pattern.replace(/^\//, ''), element }];
  });
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      ...buildModuleRoutes(),
      ...buildSubRoutes(),
      ...buildRecordRoutes(),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
