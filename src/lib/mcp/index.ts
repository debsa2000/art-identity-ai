import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import updateMyProfile from "./tools/update-my-profile";
import listMyArtworks from "./tools/list-my-artworks";
import createArtwork from "./tools/create-artwork";
import listMyInquiries from "./tools/list-my-inquiries";
import searchDirectory from "./tools/search-directory";

// The OAuth issuer MUST be the direct Supabase host, not the .lovable.cloud proxy.
// VITE_SUPABASE_PROJECT_ID is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "art-identity-ai",
  title: "Art Identity AI",
  version: "0.1.0",
  instructions:
    "Tools for artists on Art Identity AI. Use these to read and update the signed-in artist's profile, list and add artworks, review collector inquiries, and search the public artist directory.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyProfile,
    updateMyProfile,
    listMyArtworks,
    createArtwork,
    listMyInquiries,
    searchDirectory,
  ],
});
