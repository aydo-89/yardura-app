import SignInClient from "./SignInClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignInPage() {
  return <SignInClient />;
}
