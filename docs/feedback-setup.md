# Feedback setup

The footer opens `#/feedback`. The form posts directly to Formspree, which handles delivery and any spam-verification steps. Players need no account. No API key or backend is needed.

1. Create an account at https://formspree.io and verify your email.
2. In the dashboard, create a new form named **DestinyDoku feedback**.
3. Set the form’s **Target Email** to the address where you want reports delivered and complete any verification requested.
4. Open **Integration** and copy the form ID from its endpoint. For `https://formspree.io/f/abcdefgh`, the ID is `abcdefgh`.
5. Set `formspreeFormId` in `src/config/feedback.ts` to that ID. The ID is public and can be committed; never use an account API key here.
6. Test locally by submitting a clearly labelled test report. Confirm it appears in the Formspree dashboard and reaches your inbox. Check spam if necessary.
7. Commit and push the configuration with the release so GitHub Actions rebuilds the Pages site. Test the live form once after deployment.

Until an ID is configured, the form is disabled and explains that submissions are not yet available. Submissions go to Formspree/email rather than creating GitHub issues. You can review them and create issues yourself.

Official setup guide: https://help.formspree.io/articles/building-your-form/building-an-html-form
