import { Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import { enabledModules, enabledRecordRoutes } from './modules';
import { MorningBriefPage } from '@/modules/dashboard/MorningBriefPage';
import {
  ApprovalsPage,
  CalendarPage,
  CompanyDetailPage,
  CrmPage,
  HealthPage,
  InboxPage,
  IntegrationsPage,
  MeetingsPage,
  OpportunityDetailPage,
  PersonDetailPage,
  PipelinePage,
  ProjectsPage,
  SettingsPage,
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
  integrations: <IntegrationsPage />,
  settings: <SettingsPage />,
};

/** Keyed by the record-route id declared in the registry. */
const recordElements: Record<string, RouteObject['element']> = {
  'crm-person': <PersonDetailPage />,
  'crm-company': <CompanyDetailPage />,
  'pipeline-opportunity': <OpportunityDetailPage />,
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
      ...buildRecordRoutes(),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
