# Scout reliability review — September 20, 2026

## State and boundaries

Working copy: `opportunity-scout-review`, based on GitHub `8731fc8f99facca5f36267d12d71e9df6f69d720`. The original checkout was clean and remains unchanged. The user approved deployment and the submission update on September 20. Backend and frontend are deployed. No billing, inbox, credential or webhook changes were made. A pre-deployment snapshot is retained locally in ignored output files.

Read-only live evidence:

- GitHub HEAD matched the starting checkout.
- Convex returned 106 opportunity records in a request capped at 120: 96 hackathons, four grants, six gigs. The snapshot's fresh/open/future-deadline subset was 79 hackathons, two grants and four gigs. These are catalog records, not independently re-verified external source pages in this review, and not queued leads.
- The existing launch connection-test receipt is `sent`, thread `993da4d0-788f-451c-90ac-573aea1b34b7`. It is explicitly not accepted as personalized-digest or reply-loop proof.
- [Public VibeApps submission](https://vibeapps.dev/s/opportunity-scout) exists, tagged AllGasHackathon, with a changelog timestamp of September 17, 2026 at 16:08 and the existing YouTube demo. The public submission was updated and its saved text verified on September 20, including hackathon scope, controlled live email evidence, 107 tests, and the earlier-video limitation.

## Tested behavior

The original 78 tests passed before changes. The updated local suite has 107 passing tests across 22 files. Production build and TypeScript pass; the patched AgentMail component source also passes a separate TypeScript check. The 16 Convex transaction tests run the actual application functions and component code, with fake time and a mocked provider. They are not real email/provider proof.

Coverage includes generation failure after `nextDigestAt` advances; stable period deduplication; crashed leases; a three-attempt ceiling; late-worker fencing; reply failure after deduplication; repeated replies; STOP with AI/sending unavailable; foreign sender, inbox, parent and project thread; unsubscribe/resubscribe invalidation; provider transport failure with identical HTTP idempotency keys; pre-send evidence changes; cross-source duplicates/conflicts; annual editions on a reused URL; retained saves and reversible grouping; date-only uncertainty; cash/credits and currency ambiguity; and a strong candidate beyond the first UI page. Existing deadline/cash/parser tests remain in place.

Local browser checks use the September 20 source snapshot and explicitly labelled simulated conflict/delivery states. They do not call the hosted backend. At 390×844, preferences, unsubscribe feedback, digest status, source disagreements, expanded evidence and disabled conflicting calendar export render correctly with no horizontal overflow. Browser console has no relevant errors. The 1280×900 desktop and 320×740 narrow-screen checks also had no horizontal overflow or console warnings/errors. The latest narrow-screen briefing screenshot includes the revised hackathon-only prompts.

## Bounded usage

Measured with Convex's transaction metrics in the local harness:

| Scenario                                                   | Indexed queries | Documents read | Bytes read | Writes |
| ---------------------------------------------------------- | --------------: | -------------: | ---------: | -----: |
| 280 compact fixture records, candidate selection           |               1 |            250 |    114,140 |      0 |
| 280-row growth scenario using current source payload sizes |               1 |            250 |    256,638 |      0 |

The second scenario reuses captured public source records for payload sizing; it returned 240 active records after validation. It is not a claim that the live catalog contains 280 opportunities. These figures measure candidate selection only, not Mastra memory, discovery, component internals or total production billing. The local review made no provider calls. The approved release verification subsequently used the existing gateway and sent one normal digest and two refined responses to the explicitly authorized owner, with three Gmail test replies including STOP. No discovery refresh was triggered for this release; total provider billing was not measured.

Configured limits: 250 indexed candidate records; 25 eligible matches offered to the model; three accepted picks; three Mastra steps with SDK retries disabled, 1,800 output tokens per step and a 120-second total model budget; three generation attempts per logical job. Recovery reads at most 25 due digest and 25 due reply rows per five-minute invocation. Identity groups have at most 12 sources; backfill pages contain 25 records. Polling is limited to four pages of 25 recent delivery rows per invocation chain, the last 20 messages per thread, and a 30-day delivery window. A persisted cursor prevents the newest page from permanently starving older eligible threads. This is a ceiling, not observed provider traffic.

## Migration and rollback

All schema additions are optional on existing tables. New evidence tables are additive. A source's original opportunity ID remains stable. Canonical pointers are resolved when reading saves; toggling a canonical save removes that user's equivalent alias saves. Old shortlist references are retained. Legacy shortlists without revalidation snapshots are hidden from the current recommendation panel until regenerated.

`identity:backfill` processes 25 rows at a time and only groups records that already contain valid strong identity evidence. It does not infer evidence for old rows. `identity:rollback` restores the old pointer and records a review hold so the same automatic merge cannot recur. Run one batch, inspect results and keep its cursor; do not run an unattended full-catalog rewrite.

`email:migrateDeliveries` is an operator-only, bounded migration for legacy generation records. Old records without an outbound message can be retried only when still inside their period and opted in. Existing outbound records require receipt review. Legacy reply rows contain only a message ID; their original text and whether a response was already sent cannot be inferred safely. Reconcile them against provider receipts before any replay. New replies are fully recoverable.

## AgentMail patch and remaining risks

The pinned component patch preserves the existing environment contract and adds an application query callback before each provider attempt. The internal `X-Scout-Guard` value is stripped from the provider payload. Transport retries use the same `Idempotency-Key` HTTP header, supported by [AgentMail's send-idempotency documentation](https://docs.agentmail.to/idempotency). The provider's retention is 24 hours; the component refuses attempts older than 23 hours. Recovery also terminates pending jobs after a conservative 23-hour window from job creation. Already accepted receipts are reconciled as sent even if consent has since changed. A failed receipt is terminal until reviewed; no new outbound record is silently created.

An unsubscribe committed before a queued worker's guard prevents its send. An HTTP send already in flight cannot be atomically recalled; cancellation must not be described as proof that the recipient received nothing. The backend push and provider delivery are verified. Provider idempotency under an actual lost HTTP response remains covered by mocked transport tests rather than a deliberately induced live failure. No other project's component deployment or shared webhook is changed by local edits.

Identity intentionally abstains on generic organizers, unnamed editions, unsupported platform identifiers and ambiguous cross-links. This will leave some duplicates separate. Conflicting wording may also withhold an otherwise valid recommendation; review the original sources rather than choosing the more attractive claim. Revalidation uses captured source facts within the 48-hour freshness window, not a newly fetched external page on every recommendation or send.

## Release procedure and real email proof

1. Review the local diff and approve a Scout-only backend/frontend deployment. Automatic approval review rejected the attempted anonymous Convex startup because the command can push backend changes. No alternate deployment route was used.
2. Back up the current deployment; pause Scout sends during migration. Preserve the existing provider selection, credentials, shared inbox and webhooks. Deploy the additive schema, functions and tested component patch. Verify generated types and deployed function checks. Roll back code if those fail; retain additive data for audit.
3. Inspect legacy queued sends and reconcile receipts. Run bounded migration batches and inspect canonical pointers/conflicts. Restore Scout sending only when its guards are verified.
4. Confirm a specific owned/consenting recipient and saved profile. Trigger one normal digest period through the durable lifecycle. Record profile/period/job IDs, source check timestamps and the provider receipt. Do not use `testDelivery:send` as substitute evidence.
5. The recipient replies in that exact thread with a concrete refinement, such as “Only solo-friendly options open to India, with twelve hours available.” Verify the saved reply event, a refined source-grounded response, and its delivered message/thread IDs. Replay the same inbound ID; verify zero additional outbounds.
6. Test STOP while AI is unavailable and while a new Scout message is queued. Confirm consent is off and the queued send cannot reach the provider. Preserve the provider-in-flight limitation above.
7. Check the latest hosted mobile UI and current source freshness; record the decision-and-email demo only after these gates pass. Approve the public submission wording/video update separately. Do not claim human feedback unless a person provides it.

## September 20 executed verification

- Backend typecheck/deploy succeeded on `graceful-spoonbill-850`; static hosting upload succeeded. Convex AI Gateway smoke returned `connected`. The live bounded candidate query returned 79 active records.
- The delivery migration examined an empty table; zero records changed. The first identity batch changed zero of 25 legacy records, because they lack strong identity evidence. No unsupported aliases were invented or old saves rewritten.
- Hosted mobile 390×844 and desktop 1280×900 checks passed without horizontal overflow. The authenticated advisor processed a real India/solo/12-hour question and abstained. No fixture content was used in this hosted check.
- Normal digest period `2959` produced delivery `jx7ar79ge8cxw684avjvx8dywn8esq9w`, received in Gmail at 03:16:33 UTC. AgentMail thread `2875835f-7013-42ec-af3d-34491afa1f19` contains the authorized replies and responses.
- Initial polling exposed inaccessible component reader exports. A direct replay of the real first reply verified the handler but was not counted as automatic polling proof. A proposed public-export change was rejected by automatic approval review and was not executed. The final repair keeps component exports private and reads only Scout-owned threads through an internal poller, checking returned inbox/thread IDs.
- After the repair, a fresh Gmail reply was processed by normal `email:pollReplies` with `checked: 1, failed: 0`. Gmail received a two-option refined response at 03:30:31 UTC, message `1a0bcdd8e15e71f5`, in the original Gmail thread. Its MIME payload contains both `text/plain` and `text/html`; headings, links, lists, UTF-8 and spacing were verified. A local rendered email preview also passed at 390px with no overflow.
- Re-polling the same messages left exactly two refinement jobs, each with one attempt and its original outbound ID. No extra response was generated. STOP then returned `checked: 1, failed: 0`; the owner's profile is unsubscribed with consent version 2. Scout's service send setting was restored to its previous value. Queued-send races and AI-failure STOP remain additionally covered by transaction tests.
- This was an agent-operated test explicitly authorized by the owner, not independent human feedback. The shared sender still displays RentPilot; its configuration and webhooks were preserved.

Remaining limits: source revalidation uses captures up to 48 hours old; total daily production usage is unmeasured; legacy evidence is not retroactively inferred. The existing public video remains the earlier walkthrough. A 160-second decision/email recording plan is local-only; a new video has not been recorded or published.
