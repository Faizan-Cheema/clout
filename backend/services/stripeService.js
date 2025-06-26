import Stripe from 'stripe';
import pool from '../config/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe Price IDs - Replace with your actual Stripe price IDs
const STRIPE_PRICE_IDS = {
  essential: {
    monthly: process.env.STRIPE_ESSENTIAL_MONTHLY_PRICE_ID,
    annually: process.env.STRIPE_ESSENTIAL_ANNUALLY_PRICE_ID
  },
  professional: {
    monthly: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID,
    annually: process.env.STRIPE_PROFESSIONAL_ANNUALLY_PRICE_ID
  },
  advanced: {
    monthly: process.env.STRIPE_ADVANCED_MONTHLY_PRICE_ID,
    annually: process.env.STRIPE_ADVANCED_ANNUALLY_PRICE_ID
  }
};

export const createCustomer = async (email, name) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'clout_platform'
      }
    });
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

export const createSubscription = async (customerId, priceId, userId) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: userId
      }
    });
    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

export const createCheckoutSession = async (priceId, customerId, userId, planType, billingCycle) => {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: {
        userId: userId,
        planType: planType,
        billingCycle: billingCycle
      },
      subscription_data: {
        metadata: {
          userId: userId,
          planType: planType,
          billingCycle: billingCycle
        }
      }
    });
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

export const getSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    throw error;
  }
};

export const cancelSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

export const reactivateSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    return subscription;
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw error;
  }
};

export const updateSubscription = async (subscriptionId, newPriceId) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
    });
    return updatedSubscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
};

export const saveSubscriptionToDB = async (userId, stripeCustomerId, stripeSubscriptionId, stripePriceId, planType) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    
    const query = `
      INSERT INTO subscriptions (
        user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, 
        plan_type, status, current_period_start, current_period_end, cancel_at_period_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_price_id = EXCLUDED.stripe_price_id,
        plan_type = EXCLUDED.plan_type,
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      planType,
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000),
      subscription.cancel_at_period_end
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving subscription to DB:', error);
    throw error;
  }
};

export const getUserSubscription = async (userId) => {
  try {
    const query = 'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1';
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user subscription:', error);
    throw error;
  }
};

export const updateSubscriptionStatus = async (subscriptionId, status, cancelAtPeriodEnd = false) => {
  try {
    const query = `
      UPDATE subscriptions 
      SET status = $1, cancel_at_period_end = $2, updated_at = CURRENT_TIMESTAMP
      WHERE stripe_subscription_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [status, cancelAtPeriodEnd, subscriptionId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
};

export const getPriceId = (planType, billingCycle) => {
  return STRIPE_PRICE_IDS[planType]?.[billingCycle];
};

export { STRIPE_PRICE_IDS, stripe }; 