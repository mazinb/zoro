# Integration Checklist: Check-in & Profile Pages

## Overview
Transform the website from a blog/knowledge base focus to a financial check-in service with profile/estate planning features.

## Phase 1: Create New Pages
- [ ] Create `/src/app/checkin/page.tsx` - Convert checkin.jsx to Next.js page
- [ ] Create `/src/app/profile/page.tsx` - Convert profile.jsx to Next.js page
- [ ] Ensure both pages use TypeScript and Next.js conventions
- [ ] Integrate with existing theme system (useThemeClasses hook)
- [ ] Add proper routing and navigation

## Phase 2: Update PhilosophyPage
- [ ] Replace `/blog` references with `/checkin` in PhilosophyPage.tsx
- [ ] Update "You Feed Zoro" section to focus on check-ins instead of articles
- [ ] Update "Zoro Learns" section to mention check-in responses and goal tracking
- [ ] Update "You Decide" section to emphasize check-in frequency and goal selection
- [ ] Update roadmap to reflect check-in service focus
- [ ] Update CTA buttons to point to `/checkin` instead of `/blog`

## Phase 3: Update Navigation & Links
- [ ] Update LandingPage.tsx to link to `/checkin` instead of `/blog`
- [ ] Update login redirects from `/blog` to `/checkin`
- [ ] Update ProtectedRoute redirects from `/blog` to `/checkin`
- [ ] Update CommunicationPreference redirect from `/blog` to `/checkin`
- [ ] Update any other `/blog` references throughout the codebase

## Phase 4: Component Integration
- [ ] Convert checkin.jsx JSX to TypeScript React component
- [ ] Convert profile.jsx JSX to TypeScript React component
- [ ] Integrate with existing auth system (useAuth hook)
- [ ] Use existing UI components (Button, Card) where possible
- [ ] Ensure theme consistency with rest of app
- [ ] Add proper error handling and loading states

## Phase 5: Content Updates
- [ ] Update PhilosophyPage hero text to mention check-ins
- [ ] Update "Why This Approach Works" section for check-in service
- [ ] Update roadmap items to reflect check-in features
- [ ] Ensure all copy aligns with check-in service model

## Phase 6: Testing & Cleanup
- [ ] Test checkin page navigation and functionality
- [ ] Test profile page navigation and functionality
- [ ] Verify theme switching works on both pages
- [ ] Verify auth integration works correctly
- [ ] Check for any broken links or references
- [ ] Remove or archive old blog-related code if no longer needed

## Notes
- Keep the essence of checkin.jsx: frequency selection, goal cards, sample email preview
- Keep the essence of profile.jsx: comprehensive financial profile and estate planning
- Maintain existing design tokens and theme system
- Ensure responsive design works on both new pages

