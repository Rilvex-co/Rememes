require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

app.post('/send', async (req, res) => {
  const { userId, title, body, url } = req.body;
  if (!userId || !title) {
    return res.status(400).json({ error: 'Missing userId or title' });
  }

  // Fetch user's push subscriptions
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return res.json({ success: true, sent: 0 });
  }

  const payload = JSON.stringify({
    title,
    body,
    url,
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      sent++;
    } catch (err) {
      console.error('Push send error:', err);
      // Remove expired subscription
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  res.json({ success: true, sent });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Push server running on port ${PORT}`));
