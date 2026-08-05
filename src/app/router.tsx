import { Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import { enabledModules } from './modules';
import { ApprovalsPage } from '@/modules/approvals/ApprovalsPage';
import { MorningBriefPage } from '@/modules/dashboard/MorningBriefPage';
import { HealthPage } from '@/modules/health/HealthPage';
import { InboxPage } from '@/modules/inbox/InboxPage';
import { IntegrationsPage } from '@/modules/integrations/IntegrationsPage';
import { SettingsPage } from '@/modules/settings/SettingsPage';

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
  integrations: <IntegrationsPage />,
  settings: <SettingsPage />,
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

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [...buildModuleRoutes(), { path: '*', element: <Navigate to="/" replace /> }],
  },
];
