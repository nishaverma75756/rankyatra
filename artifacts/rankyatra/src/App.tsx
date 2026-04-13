import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { getAuthToken } from "@/lib/auth";
import "@/lib/auth"; // init auth token getter
import { useEffect } from "react";

import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import ExamDetail from "@/pages/ExamDetail";
import TakeExam from "@/pages/TakeExam";
import Results from "@/pages/Results";
import Dashboard from "@/pages/Dashboard";
import WalletPage from "@/pages/Wallet";
import Profile from "@/pages/Profile";
import Leaderboard from "@/pages/Leaderboard";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminUserDetail from "@/pages/admin/AdminUserDetail";
import AdminExams from "@/pages/admin/AdminExams";
import AdminExamDetail from "@/pages/admin/AdminExamDetail";
import AdminDeposits from "@/pages/admin/AdminDeposits";
import AdminWithdrawals from "@/pages/admin/AdminWithdrawals";
import AdminVerifications from "@/pages/admin/AdminVerifications";
import AdminBanners from "@/pages/admin/AdminBanners";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminCompletedExams from "@/pages/admin/AdminCompletedExams";
import AdminUpcomingExams from "@/pages/admin/AdminUpcomingExams";
import AdminReports from "@/pages/admin/AdminReports";
import AdminRoles from "@/pages/admin/AdminRoles";
import AdminGroupDetail from "@/pages/admin/AdminGroupDetail";
import AdminReelApplications from "@/pages/admin/AdminReelApplications";
import AdminBroadcast from "@/pages/admin/AdminBroadcast";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import FAQ from "@/pages/FAQ";
import TermsConditions from "@/pages/TermsConditions";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import AnswerSheet from "@/pages/AnswerSheet";
import WalletDeposit from "@/pages/WalletDeposit";
import WalletWithdraw from "@/pages/WalletWithdraw";
import VerifyPage from "@/pages/Verify";
import ChangeCredentials from "@/pages/ChangeCredentials";
import OAuthCallback from "@/pages/OAuthCallback";
import PublicProfile from "@/pages/PublicProfile";
import FollowList from "@/pages/FollowList";
import Chat from "@/pages/Chat";
import ChatConversation from "@/pages/ChatConversation";
import Moments from "@/pages/Moments";
import PostComments from "@/pages/PostComments";
import ReferralPage from "@/pages/Referral";
import { BottomNav } from "@/components/BottomNav";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function DomainGuard() {
  useEffect(() => {
    const host = window.location.hostname;
    const isDev = host === "localhost" || host.endsWith(".replit.dev") || host.endsWith(".janeway.replit.dev") || host.endsWith(".repl.co");
    if (!isDev && host !== "rankyatra.in" && host !== "www.rankyatra.in") {
      const path = window.location.pathname + window.location.search + window.location.hash;
      window.location.replace("https://rankyatra.in" + path);
    }
  }, []);
  return null;
}

function GlobalHeartbeat() {
  useEffect(() => {
    const send = () => {
      const token = getAuthToken();
      if (!token) return;
      fetch("/api/me/heartbeat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    };
    send();
    const id = setInterval(send, 30_000);
    return () => clearInterval(id);
  }, []);
  return null;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (!getAuthToken()) {
    return <Redirect to="/login" />;
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/exams" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/faq" component={FAQ} />
      <Route path="/terms" component={TermsConditions} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/exam/:id" component={ExamDetail} />
      <Route path="/exam/:id/take">
        {(params) => <ProtectedRoute component={() => <TakeExam />} />}
      </Route>
      <Route path="/exam/:id/results" component={Results} />
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/wallet">
        <ProtectedRoute component={WalletPage} />
      </Route>
      <Route path="/wallet/deposit">
        <ProtectedRoute component={WalletDeposit} />
      </Route>
      <Route path="/wallet/withdraw">
        <ProtectedRoute component={WalletWithdraw} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsers} />
      </Route>
      <Route path="/admin/users/:id">
        <ProtectedRoute component={AdminUserDetail} />
      </Route>
      <Route path="/admin/exams">
        <ProtectedRoute component={AdminExams} />
      </Route>
      <Route path="/admin/exams/:id/questions">
        <ProtectedRoute component={AdminExamDetail} />
      </Route>
      <Route path="/admin/deposits">
        <ProtectedRoute component={AdminDeposits} />
      </Route>
      <Route path="/admin/withdrawals">
        <ProtectedRoute component={AdminWithdrawals} />
      </Route>
      <Route path="/admin/verifications">
        <ProtectedRoute component={AdminVerifications} />
      </Route>
      <Route path="/admin/banners">
        <ProtectedRoute component={AdminBanners} />
      </Route>
      <Route path="/admin/categories">
        <ProtectedRoute component={AdminCategories} />
      </Route>
      <Route path="/admin/completed-exams">
        <ProtectedRoute component={AdminCompletedExams} />
      </Route>
      <Route path="/admin/upcoming-exams">
        <ProtectedRoute component={AdminUpcomingExams} />
      </Route>
      <Route path="/admin/reports">
        <ProtectedRoute component={AdminReports} />
      </Route>
      <Route path="/admin/roles">
        <ProtectedRoute component={AdminRoles} />
      </Route>
      <Route path="/admin/reel-applications">
        <ProtectedRoute component={AdminReelApplications} />
      </Route>
      <Route path="/admin/broadcast">
        <ProtectedRoute component={AdminBroadcast} />
      </Route>
      <Route path="/admin/groups/:userId">
        <ProtectedRoute component={AdminGroupDetail} />
      </Route>
      <Route path="/exam/:id/answer-sheet">
        <ProtectedRoute component={AnswerSheet} />
      </Route>
      <Route path="/verify">
        <ProtectedRoute component={VerifyPage} />
      </Route>
      <Route path="/change-credentials">
        <ProtectedRoute component={ChangeCredentials} />
      </Route>
      <Route path="/referral">
        <ProtectedRoute component={ReferralPage} />
      </Route>
      <Route path="/ref/:code" component={({ params }: any) => {
        const [, navigate] = useLocation();
        useEffect(() => {
          if (params?.code) {
            localStorage.setItem("referralCode", params.code.toUpperCase());
            fetch("/api/referral/click", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ referralCode: params.code.toUpperCase() }),
            }).catch(() => {});
          }
          navigate("/signup", { replace: true });
        }, []);
        return null;
      }} />
      <Route path="/oauth-callback" component={OAuthCallback} />
      <Route path="/user/:id" component={PublicProfile} />
      <Route path="/user/:id/:type" component={FollowList} />
      <Route path="/moments" component={Moments} />
      <Route path="/post/:id" component={({ params }: any) => { const [, navigate] = useLocation(); navigate(`/post/${params.id}/comments`, { replace: true }); return null; }} />
      <Route path="/post/:id/comments" component={PostComments} />
      <Route path="/chat">
        <ProtectedRoute component={Chat} />
      </Route>
      <Route path="/chat/:id">
        <ProtectedRoute component={ChatConversation} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const hiddenNavPaths = /^\/chat\/.+|^\/post\/\d+\/comments/;
  return (
    <>
      <DomainGuard />
      <GlobalHeartbeat />
      <ScrollToTop />
      <Router />
      {!hiddenNavPaths.test(location) && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}>
          <AppShell />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
