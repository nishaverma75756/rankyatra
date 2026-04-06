import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserPlus, UserCheck, Users } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

async function apiFetch(url: string, options?: RequestInit) {
  const token = getAuthToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...(options?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

type FollowUser = { id: number; name: string; avatarUrl: string | null; verificationStatus: string; isFollowing: boolean };

function UserRow({ u, onToggle, isSelf }: { u: FollowUser; onToggle: (id: number, following: boolean) => void; isSelf: boolean }) {
  const initials = u.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-muted/50 transition-colors rounded-xl">
      <Link href={`/user/${u.id}`}>
        <Avatar className="h-11 w-11 border border-border cursor-pointer shrink-0">
          <AvatarImage src={u.avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/user/${u.id}`} className="font-bold text-sm hover:underline">{u.name}</Link>
        {u.verificationStatus === "verified" && (
          <p className="text-xs text-emerald-600 font-semibold mt-0.5">✓ KYC Verified</p>
        )}
      </div>
      {!isSelf && (
        <Button
          size="sm"
          variant={u.isFollowing ? "outline" : "default"}
          className="shrink-0 gap-1.5 font-bold text-xs h-8"
          onClick={() => onToggle(u.id, u.isFollowing)}
        >
          {u.isFollowing ? <><UserCheck className="h-3.5 w-3.5" /> Following</> : <><UserPlus className="h-3.5 w-3.5" /> Follow</>}
        </Button>
      )}
    </div>
  );
}

export default function FollowList() {
  const { id, type } = useParams() as { id: string; type: string };
  const userId = parseInt(id ?? "0");
  const isFollowers = type === "followers";
  const { user: me } = useAuth();
  const queryClient = useQueryClient();

  const qKey = ["/api/users", userId, type];
  const { data = [], isLoading } = useQuery<FollowUser[]>({
    queryKey: qKey,
    queryFn: () => apiFetch(`/api/users/${userId}/${type}`),
    enabled: userId > 0,
    staleTime: 30_000,
  });

  const followMutation = useMutation({
    mutationFn: (targetId: number) => apiFetch(`/api/users/${targetId}/follow`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });
  const unfollowMutation = useMutation({
    mutationFn: (targetId: number) => apiFetch(`/api/users/${targetId}/follow`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });

  function handleToggle(targetId: number, currentlyFollowing: boolean) {
    if (!me) return;
    if (currentlyFollowing) unfollowMutation.mutate(targetId);
    else followMutation.mutate(targetId);
  }

  const isMine = !!(me && (me as any).id === userId);
  const backHref = isMine ? "/profile" : `/user/${userId}`;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-lg">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 font-semibold transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Profile
        </Link>

        <div className="flex items-center gap-3 mb-5">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black">{isFollowers ? "Followers" : "Following"}</h1>
            <p className="text-xs text-muted-foreground font-semibold">{data.length} {isFollowers ? "people follow this user" : "people this user follows"}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-bold text-muted-foreground">{isFollowers ? "No followers yet" : "Not following anyone yet"}</p>
          </div>
        ) : (
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-card">
            {data.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                isSelf={!!(me && (me as any).id === u.id)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
