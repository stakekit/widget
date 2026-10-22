import InlineEncryptWorker from "@zama-fhe/sdk/encrypt.worker.js?worker&inline";

// Its own module so the inlined script (~5 MB) ships in a chunk that only
// hosts without a served worker script download.
export default InlineEncryptWorker;
