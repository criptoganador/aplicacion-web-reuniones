import { stripe } from '../config/stripe.js';
import { config } from '../config/index.js';
import { pool } from '../db.js';

/**
 * Create Stripe checkout session
 */
export async function createCheckoutSession(organizationId, userEmail) {
  // Get or create Stripe customer
  const orgResult = await pool.query(
    'SELECT stripe_customer_id FROM organizations WHERE id = $1',
    [organizationId]
  );
  
  let customerId = orgResult.rows[0]?.stripe_customer_id;
  
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { organizationId },
    });
    customerId = customer.id;
    
    await pool.query(
      'UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2',
      [customerId, organizationId]
    );
  }
  
  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: config.stripe.priceIdPro,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${config.frontendUrl}/admin?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.frontendUrl}/admin`,
    metadata: { organizationId },
  });
  
  return { url: session.url };
}

/**
 * Create Stripe billing portal session
 */
export async function createPortalSession(organizationId) {
  const orgResult = await pool.query(
    'SELECT stripe_customer_id FROM organizations WHERE id = $1',
    [organizationId]
  );
  
  const customerId = orgResult.rows[0]?.stripe_customer_id;
  
  if (!customerId) {
    throw new Error('No se encontró información de facturación');
  }
  
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${config.frontendUrl}/admin`,
  });
  
  return { url: session.url };
}

/**
 * Handle Stripe webhook
 */
export async function handleStripeWebhook(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const organizationId = session.metadata.organizationId;
      
      await pool.query(
        `UPDATE organizations 
         SET plan = 'pro', 
             stripe_subscription_id = $1,
             subscription_status = 'active'
         WHERE id = $2`,
        [session.subscription, organizationId]
      );
      break;
    }
    
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      
      await pool.query(
        `UPDATE organizations 
         SET subscription_status = $1
         WHERE stripe_subscription_id = $2`,
        [subscription.status, subscription.id]
      );
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      
      await pool.query(
        `UPDATE organizations 
         SET plan = 'free',
             subscription_status = 'canceled'
         WHERE stripe_subscription_id = $1`,
        [subscription.id]
      );
      break;
    }
  }
}

/**
 * Check plan limits
 */
export async function checkPlanLimits(organizationId, resource) {
  const orgResult = await pool.query(
    'SELECT plan FROM organizations WHERE id = $1',
    [organizationId]
  );
  
  const plan = orgResult.rows[0]?.plan || 'free';
  const limits = config.planLimits[plan];
  
  if (resource === 'users') {
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM user_organizations WHERE organization_id = $1',
      [organizationId]
    );
    const count = parseInt(countResult.rows[0].count);
    
    if (count >= limits.users) {
      throw new Error(
        `Límite de usuarios alcanzado para el plan ${plan.toUpperCase()} (${count}/${limits.users}). Actualiza tu plan.`
      );
    }
  }
  
  return true;
}
