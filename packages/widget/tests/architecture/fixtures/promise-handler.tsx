import { useNavigate as useRouterNavigate } from "react-router";

declare const prepare: () => Promise<void>;
declare const consume: (work: Promise<void>) => void;
declare const dispatch: () => void;
declare const navigate: () => Promise<void>;

const directPromiseHandler = () => prepare();
const initializerHandler = () => {
  const pending = prepare();
  void pending;
};
const argumentHandler = () => consume(prepare());
const fakeNavigateHandler = () => navigate();

const routerHandler = () => {
  const go = useRouterNavigate();
  return () => go("/");
};

const jsxHandler = <button type="button" onClick={prepare} />;
const callbacks = { onClick: prepare };
const validHandler = () => dispatch();
const passThrough = (input: Promise<void>) => input;
function select(value: { pending: Promise<void> }) {
  return value.pending;
}
const reassignedRouterHandler = () => {
  let go = useRouterNavigate();
  go = prepare;
  go("/");
};

void directPromiseHandler;
void initializerHandler;
void argumentHandler;
void fakeNavigateHandler;
void routerHandler;
void jsxHandler;
void callbacks;
void validHandler;
void passThrough;
void select;
void reassignedRouterHandler;
