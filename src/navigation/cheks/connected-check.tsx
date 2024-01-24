import { Navigate, Outlet } from "react-router-dom";
import { useSKWallet } from "../../providers/sk-wallet";

export const ConnectedCheck = () => {
  const { isConnected } = useSKWallet();

  return isConnected ? <Outlet /> : <Navigate to="/" replace />;
};
