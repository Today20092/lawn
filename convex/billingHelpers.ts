import { ConvexError } from "convex/values";
import { components } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

export type TeamPlan = "basic" | "pro";

const GIBIBYTE = 1024 ** 3;

export const TEAM_PLAN_MONTHLY_PRICE_USD: Record<TeamPlan, number> = {
  basic: 5,
  pro: 25,
};

// Self-hosted free mode: no billing; cap storage at 100 GB (about $1.35/month on R2 past the free 10 GB).
export const FREE_STORAGE_LIMIT_BYTES = 100 * GIBIBYTE;

export const TEAM_PLAN_STORAGE_LIMIT_BYTES: Record<TeamPlan, number> = {
  basic: FREE_STORAGE_LIMIT_BYTES,
  pro: FREE_STORAGE_LIMIT_BYTES,
};

function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeStoredTeamPlan(plan: string): TeamPlan {
  if (plan === "pro" || plan === "team") return "pro";
  return "basic";
}

export function resolvePlanFromStripePriceId(
  stripePriceId: string | undefined | null,
): TeamPlan | null {
  if (!hasText(stripePriceId)) return null;

  const basicPriceId = process.env.STRIPE_PRICE_BASIC_MONTHLY;
  const proPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY;

  if (hasText(basicPriceId) && stripePriceId === basicPriceId) return "basic";
  if (hasText(proPriceId) && stripePriceId === proPriceId) return "pro";
  return null;
}

export function getStripePriceIdForPlan(plan: TeamPlan): string {
  const variableName = plan === "basic" ? "STRIPE_PRICE_BASIC_MONTHLY" : "STRIPE_PRICE_PRO_MONTHLY";
  const value = process.env[variableName];
  if (!hasText(value)) {
    throw new Error(`${variableName} is not configured`);
  }
  return value;
}

export function hasActiveTeamSubscriptionStatus(status: string | undefined | null): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

type BillingCtx = QueryCtx | MutationCtx;

export async function getTeamSubscriptionByOrgId(ctx: BillingCtx, teamId: Id<"teams">) {
  return await ctx.runQuery(components.stripe.public.getSubscriptionByOrgId, {
    orgId: teamId,
  });
}

export async function getTeamSubscriptionState(ctx: BillingCtx, teamId: Id<"teams">) {
  const team = await ctx.db.get(teamId);
  if (!team) {
    throw new Error("Team not found");
  }
  // Billing disabled: every team is treated as active.
  const subscription = null as Awaited<ReturnType<typeof getTeamSubscriptionByOrgId>>;
  return { team, subscription, plan: "pro" as TeamPlan, hasActiveSubscription: true };
}

export async function getTeamStorageUsedBytes(ctx: BillingCtx, teamId: Id<"teams">) {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect();

  const videosByProject = await Promise.all(
    projects.map((project) =>
      ctx.db
        .query("videos")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect(),
    ),
  );

  let total = 0;
  for (const videos of videosByProject) {
    for (const video of videos) {
      if (video.status === "failed") continue;
      if (typeof video.fileSize === "number" && Number.isFinite(video.fileSize)) {
        total += video.fileSize;
      }
    }
  }

  return total;
}

export async function assertTeamHasActiveSubscription(ctx: BillingCtx, teamId: Id<"teams">) {
  const state = await getTeamSubscriptionState(ctx, teamId);
  if (!state.hasActiveSubscription) {
    throw new ConvexError("An active Basic or Pro subscription is required.");
  }
  return state;
}

export async function assertTeamCanStoreBytes(
  ctx: BillingCtx,
  teamId: Id<"teams">,
  incomingBytes: number,
) {
  const [state, storageUsedBytes] = await Promise.all([
    assertTeamHasActiveSubscription(ctx, teamId),
    getTeamStorageUsedBytes(ctx, teamId),
  ]);
  const storageLimitBytes = TEAM_PLAN_STORAGE_LIMIT_BYTES[state.plan];
  const requestedBytes = Number.isFinite(incomingBytes) ? Math.max(0, incomingBytes) : 0;

  if (storageUsedBytes + requestedBytes > storageLimitBytes) {
    throw new ConvexError(
      state.plan === "pro"
        ? "Storage is full (100 GB limit). Delete old videos or versions to free up space."
        : "Storage limit reached for the basic plan. Upgrade to continue uploading.",
    );
  }

  return {
    ...state,
    storageUsedBytes,
    storageLimitBytes,
  };
}
