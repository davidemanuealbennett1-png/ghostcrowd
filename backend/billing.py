import os
import stripe
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

PRICE_IDS = {
    "basic": os.environ.get("STRIPE_BASIC_PRICE_ID"),
    "pro": os.environ.get("STRIPE_PRO_PRICE_ID"),
    "max": os.environ.get("STRIPE_MAX_PRICE_ID"),
}

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://ghostcrowd.app")

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    tier: str
    user_id: str
    email: str


class PortalRequest(BaseModel):
    customer_id: str


@router.post("/create-checkout")
async def create_checkout(req: CheckoutRequest):
    price_id = PRICE_IDS.get(req.tier)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"Unknown tier: {req.tier}")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{FRONTEND_URL}/app?upgrade=success",
            cancel_url=f"{FRONTEND_URL}/app?upgrade=cancelled",
            customer_email=req.email,
            metadata={"user_id": req.user_id, "tier": req.tier},
            subscription_data={"metadata": {"user_id": req.user_id, "tier": req.tier}},
        )
        return {"url": session.url, "session_id": session.id}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/portal")
async def customer_portal(req: PortalRequest):
    try:
        session = stripe.billing_portal.Session.create(
            customer=req.customer_id,
            return_url=f"{FRONTEND_URL}/app",
        )
        return {"url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            event = stripe.Event.construct_from(
                stripe.util.convert_to_stripe_object(
                    stripe.util.json.loads(payload)
                ),
                stripe.api_key
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        tier = session.get("metadata", {}).get("tier")
        customer_id = session.get("customer")
        print(f"[webhook] checkout completed: user={user_id} tier={tier} customer={customer_id}")
        # TODO: update user tier in Supabase here

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        user_id = sub.get("metadata", {}).get("user_id")
        print(f"[webhook] subscription cancelled: user={user_id}")
        # TODO: downgrade user to free tier in Supabase

    return JSONResponse({"status": "ok"})


@router.get("/plans")
async def get_plans():
    return {
        "plans": [
            {
                "id": "free",
                "name": "Free",
                "price": 0,
                "interval": None,
                "agents": 50,
                "floor_plans": 1,
                "features": ["1 floor plan", "Up to 50 agents", "Basic heat map", "All drawing tools", "6 templates"],
                "cta": "Get started free",
            },
            {
                "id": "basic",
                "name": "Basic",
                "price": 12,
                "interval": "month",
                "agents": 100,
                "floor_plans": 3,
                "features": ["3 floor plans", "Up to 100 agents", "Heat map", "All drawing tools"],
                "missing": ["PDF export", "Share via link", "Bottleneck markers"],
                "cta": "Start Basic",
                "price_id": PRICE_IDS["basic"],
            },
            {
                "id": "pro",
                "name": "Pro",
                "price": 19,
                "interval": "month",
                "agents": 500,
                "floor_plans": -1,
                "featured": True,
                "features": ["Unlimited floor plans", "Up to 500 agents", "Heat maps + bottleneck detection", "PDF report export", "Share simulations via link", "All agent types", "Priority support"],
                "cta": "Start Pro",
                "price_id": PRICE_IDS["pro"],
            },
            {
                "id": "max",
                "name": "Business",
                "price": 49,
                "interval": "month",
                "agents": 2000,
                "floor_plans": -1,
                "features": ["Up to 2,000 agents", "Team collaboration", "White-label PDF reports", "API access", "Priority support", "Dedicated onboarding"],
                "cta": "Start Business",
                "price_id": PRICE_IDS["max"],
            },
        ]
    }
