import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import NewSession from "./pages/NewSession";
import SessionPage from "@/pages/SessionPage";
import SeasonDashboard from "./pages/SeasonDashboard";
import ScoutingChallenge from "./pages/ScoutingChallenge";
import Landing from "./pages/Landing";
import WarRoomPage from "./pages/WarRoomPage";
import Sim3DTest from "./pages/Sim3DTest";

function Router() {
  return (
    <Switch>
      <Route path="/landing" component={Landing} />
      {import.meta.env.DEV && <Route path="/sim3d-test" component={Sim3DTest} />}
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/new" component={NewSession} />
            <Route path="/season" component={SeasonDashboard} />
            <Route path="/challenge" component={ScoutingChallenge} />
            <Route path="/session/:id" component={SessionPage} />
            <Route path="/warroom/:id" component={WarRoomPage} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
