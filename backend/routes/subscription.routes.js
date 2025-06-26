import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createCustomer,
  createCheckoutSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  saveSubscriptionToDB,
  getUserSubscription,
  updateSubscriptionStatus,
  getPriceId,
  stripe
} from '../services/stripeService.js';
import pool from '../config/db.js';

const router = express.Router();

// Create checkout session for subscription
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { planType, billingCycle } = req.body;
    const userId = req.user.id;

    // Get user details
    const userQuery = 'SELECT email, first_name, last_name FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create Stripe customer
    let customerQuery = 'SELECT stripe_customer_id FROM users WHERE id = $1';
    let customerResult = await pool.query(customerQuery, [userId]);
    let stripeCustomerId = customerResult.rows[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await createCustomer(user.email, `${user.first_name} ${user.last_name}`);
      stripeCustomerId = customer.id;
      
      // Save customer ID to user table
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [stripeCustomerId, userId]
      );
    }

    // Get price ID for the selected plan
    const priceId = getPriceId(planType, billingCycle);
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan or billing cycle' });
    }

    // Create checkout session
    const session = await createCheckoutSession(
      priceId,
      stripeCustomerId,
      userId,
      planType,
      billingCycle
    );

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Get user's current subscription
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return res.json({ subscription: null });
    }

    // Get Stripe subscription details
    const stripeSubscription = await getSubscription(subscription.stripe_subscription_id);
    
    res.json({
      subscription: {
        ...subscription,
        stripeSubscription
      }
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel in Stripe
    await cancelSubscription(subscription.stripe_subscription_id);
    
    // Update in database
    await updateSubscriptionStatus(
      subscription.stripe_subscription_id,
      'canceled',
      true
    );

    res.json({ message: 'Subscription canceled successfully' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription
router.post('/reactivate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Reactivate in Stripe
    await reactivateSubscription(subscription.stripe_subscription_id);
    
    // Update in database
    await updateSubscriptionStatus(
      subscription.stripe_subscription_id,
      'active',
      false
    );

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Webhook to handle Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        if (session.mode === 'subscription') {
          const subscription = await getSubscription(session.subscription);
          await saveSubscriptionToDB(
            session.metadata.userId,
            session.customer,
            session.subscription,
            subscription.items.data[0].price.id,
            session.metadata.planType
          );
        }
        break;

      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object;
        await updateSubscriptionStatus(
          updatedSubscription.id,
          updatedSubscription.status,
          updatedSubscription.cancel_at_period_end
        );
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        await updateSubscriptionStatus(
          deletedSubscription.id,
          'canceled',
          false
        );
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        if (failedInvoice.subscription) {
          await updateSubscriptionStatus(
            failedInvoice.subscription,
            'past_due',
            false
          );
        }
        break;

      case 'invoice.payment_succeeded':
        const succeededInvoice = event.data.object;
        if (succeededInvoice.subscription) {
          await updateSubscriptionStatus(
            succeededInvoice.subscription,
            'active',
            false
          );
        }
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router; 