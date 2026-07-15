import { Navigate, Outlet } from "react-router";
import { useSKWallet } from "../../../features/wallet";

export const ConnectedCheck = () => {
  const { isConnected } = useSKWallet();

  return isConnected ? <Outlet /> : <Navigate to="/" replace />;
};
