import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        signup: resolve(__dirname, 'signup.html'),
        create: resolve(__dirname, 'create.html'),
        profile: resolve(__dirname, 'profile.html'),
        post: resolve(__dirname, 'post.html'),
        user: resolve(__dirname, 'user.html'),
        search: resolve(__dirname, 'search.html'),
        notifications: resolve(__dirname, 'notifications.html'),
        settings: resolve(__dirname, 'settings.html'),
        admin: resolve(__dirname, 'admin.html'),
        remix: resolve(__dirname, 'remix.html'),
        templates: resolve(__dirname, 'templates.html'),
        editProfile: resolve(__dirname, 'edit-profile.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
      },
    },
  },
});
