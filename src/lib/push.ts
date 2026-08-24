export async function sendPush(userId: string, type: string) {
  const url = 'https://niqnewlzxwvrrhfsjvlz.supabase.co/functions/v1/SEND-PUSH';
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        record: {
          user_id: userId,
          type: type,
        },
      }),
    });
  } catch (error) {
    console.error('Error sending push:', error);
  }
}
