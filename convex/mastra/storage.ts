import {mastraStorage} from '@mastra/convex/server';
import {internalMutation,type MutationCtx} from '../_generated/server';
import {v} from 'convex/values';
// The upstream handler is public and has no tenant authorization. Expose it only
// internally; ConvexStore uses this deployment's server-side admin credential.
const storageHandler=(mastraStorage as unknown as {_handler:(ctx:MutationCtx,args:unknown)=>Promise<unknown>})._handler;
export const handle=internalMutation({args:v.any(),returns:v.any(),handler:storageHandler});
