# Vendas confirmadas do atendimento

Prepared against panel main `1f991d50f3d556ac3c23d225527e93a17668dfbb`.
Production database backfill and VPS deployment require the guarded rollout; neither is performed by this change.

## Meaning

The card replaces message-text checkout counts, in the same card position. It counts only linked orders whose exact ID and store identity are confirmed by GET /orders/{id} in the Nuvemshop API and whose payment_status is strictly paid. Cancelled, authorized, refunded and partially refunded orders do not count. Phone or customer-name matches are never attribution evidence.

Sources: append-only whatsapp_checkout_created and catalog_checkout_created events plus legacy currently generated conversation checkout IDs. Catalog events require a conversation reference. UUID and normalized numeric external store identifiers are resolved through collision-safe aliases; ambiguous aliases remain unresolved. Legacy null store IDs are resolved only if exactly one connected store exists, and response store_id must still match. Immutable WhatsApp events survive conversation clearing/deletion. A prepared sequentially idempotent backfill preserves existing generated checkouts before rollout; it must not run without deployment authorization.

This is coverage of recorded links, not a promise that all older historical sales are reconstructed. Links already overwritten before this work may be irretrievable. UI expressly states this limitation. The API writer covers the two current web.js assistant generation paths (buying.legacy and cart.flow). It fails open after a bounded two-second insert attempt and logs failures without a durable retry queue. Optional Meta official-commerce generation is not instrumented. Therefore this is not guaranteed complete all-time attribution. Preserve the existing recovery summary independently; its 23 / R$6,215.84 came from recovered flags, not this payment confirmation algorithm.

## Data freshness and limits

No reliance on the stale local orders table. Evidence scanning uses database keyset pagination with a ten-second scan deadline, not a permanent 10,000-row ceiling. A scan timeout fails explicitly without presenting a complete total. Each page verifies up to 50 unique store/order pairs, with a shared per-store 750ms request slot, 40-second deadline, strict timeout, no redirects and one worker. A stable cursor advances through all remaining IDs rather than permanently ignoring links beyond the first page. UI follows pages and uses the oldest verification timestamp. Partial/unresolved results display a lower bound, never a fabricated current zero. Server per-cursor cache lasts 60 seconds; the visible tab refreshes every five minutes and upon returning to the tab. API limits or failures remain unresolved and are retried on the next refresh, not guessed.

No order mutations, payment actions, message sends, schema/permission changes, or credential generation. The existing service-role and connected Nuvemshop credentials stay server-side. Response contains aggregate counts and amounts, not customer records or secret checkout tokens/URLs.

Gross cents represent total after discounts, including customer shipping. Products cents are total minus shipping_cost_customer, so discounts are not subtracted twice. These values are not net profit, gateway payout, or guaranteed net revenue. The card currently displays sale count only.

## Rollout prerequisites

1. Review API append-only event writer and its failure/duplicate tests.
2. Authorize and execute prepared existing-checkout backfill before new-cart resets can erase current legacy identity evidence. The SQL serializes repeated backfills, not the API event writer; concurrent generation can create duplicate evidence rows, which the counter deduplicates by store/order. Do not claim cross-writer uniqueness without an authorized uniqueness migration.
3. Deploy panel and API through normal guarded rollout, preserving backup.
4. Verify one known generated link's paid/unpaid status against live Nuvemshop without placing a transaction.
5. Confirm a new cart does not remove a previously attributed paid sale.

## Evidence and limits

Official draft-order API documents conversion to order retaining the ID in its confirm example:
https://tiendanube.github.io/api-documentation/resources/draft-order
Official order status/total field definitions:
https://tiendanube.github.io/api-documentation/v1/resources/order

Live read-only database inspection found 13 current generated conversation draft IDs and 48 catalog events (36 with conversation reference), all legacy conversation store_id fields null. Seven older catalog IDs match paid order records. Local orders last updated Oct 16, 2026; webhook notification handler fetches real orders for messages but does not persist the orders table. No live Nuvemshop payment verification has yet been run from this environment, because no direct connector exists and credentials were not extracted.
