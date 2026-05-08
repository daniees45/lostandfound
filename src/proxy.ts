import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth form submissions (POST/other non-GET) should not pay an extra auth lookup here.
  if (pathname.startsWith("/auth") && request.method !== "GET") {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });
  const sessionToken = request.cookies.get("lf_session")?.value;
  const user = verifySessionToken(sessionToken);

  const protectedPaths = ["/dashboard", "/report", "/chat", "/pickup", "/profile"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const authPathsAllowedWhenSignedIn = [
    "/auth/callback",
    "/auth/reset-password",
  ];
  const isAllowedAuthPath = authPathsAllowedWhenSignedIn.some((p) =>
    pathname.startsWith(p)
  );

  if (isProtected && !user?.uid) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in and hitting auth pages → send to dashboard
  if (user?.uid && pathname.startsWith("/auth") && !isAllowedAuthPath) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.searchParams.delete("redirectTo");
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/report/:path*",
    "/chat/:path*",
    "/pickup/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/admin/:path*",
    "/auth/:path*",
  ],
};
