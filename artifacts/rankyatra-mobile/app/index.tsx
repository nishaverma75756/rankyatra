import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function IndexScreen() {
  const { isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return <Redirect href="/(tabs)/" />;
}
