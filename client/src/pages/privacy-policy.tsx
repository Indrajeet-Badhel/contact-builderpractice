import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Content */}
        <div className="prose prose-invert max-w-none space-y-6 text-foreground">
          <h1 className="text-4xl font-black font-['Space_Grotesk'] mb-2">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground">
            Effective Date: October 26, 2023
            <br />
            Last Updated: October 26, 2023
          </p>

          <hr className="my-8 border-border" />

          <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                1. Introduction
              </h2>
              <p>
                Welcome to Contact Builder ("Company", "we", "our", "us"). We provide an AI-powered
                intelligence platform designed to help businesses organize, clean, and enrich their
                professional contact databases (the "Service").
              </p>
              <p>
                We recognize that privacy is fundamental to the trust you place in us. This Privacy Policy
                describes how we collect, use, process, and disclose information when you access our
                website, use our SaaS application, or interact with our services. It also details the rights you
                have regarding your personal data and how the law protects you.
              </p>
              <p>
                This Policy applies to three categories of individuals:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Subscribers: Individuals or entities who register for an account to use our Service.</li>
                <li>Visitors: Individuals who visit our website or interact with our marketing materials.</li>
                <li>Contacts: Individuals whose business contact information is processed, enriched, or stored on our platform, whether uploaded by Subscribers or sourced from our database.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                2. Information We Collect
              </h2>
              <p>
                We collect information through three primary channels: directly from you, automatically
                through your use of the Service, and from third-party sources for enrichment purposes.
              </p>

              <h3 className="text-xl font-semibold font-['Space_Grotesk'] mt-4 mb-2">
                2.1 Information Provided by Subscribers
              </h3>
              <p>When you register for and use Contact Builder, we collect:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Account Data: Your full name, business email address, phone number, company name, and job title.</li>
                <li>Authentication Data: Password (hashed) or OAuth tokens if you sign in via Google, Microsoft, or LinkedIn.</li>
                <li>Billing Data: If you purchase a paid plan, our third-party payment processor collects your payment method details and billing address. We do not store full credit card numbers on our servers.</li>
                <li>Customer Content (User Uploads): You may upload files (PDF, CSV, Excel), connect email inboxes, or input text containing contact data. In the context of this data, you are the Data Controller and we act as the Data Processor.</li>
              </ul>

              <h3 className="text-xl font-semibold font-['Space_Grotesk'] mt-4 mb-2">
                2.2 Information Collected Automatically
              </h3>
              <p>When you interact with our platform, we use cookies and similar technologies to collect:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Device & Usage Data: IP address, browser type, operating system, referral URLs, device identifiers, and crash data.</li>
                <li>Behavioral Data: Metrics on how you use the dashboard, including features accessed, time spent on pages, and search queries.</li>
                <li>AI Interaction Logs: We collect metadata on how you interact with our AI suggestions to validate and improve the accuracy of our machine learning models.</li>
              </ul>

              <h3 className="text-xl font-semibold font-['Space_Grotesk'] mt-4 mb-2">
                2.3 Information from Third Parties (Enrichment Data)
              </h3>
              <p>To provide our data enrichment and "Contact Builder" features, we maintain a database of business contact information sourced from:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Publicly Available Sources: Information found on open web, professional social networks, press releases, and corporate websites.</li>
                <li>Data Partners: Licensed data from compliant third-party data brokers and business intelligence providers.</li>
                <li>Community Contributions: Anonymized data signals contributed by our user community to verify the accuracy of contact details.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                3. How We Use Your Information
              </h2>
              <p>
                We process personal data for specific, lawful purposes including service delivery, data enrichment, AI optimization, customer support, security & compliance, and marketing communications.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                4. Artificial Intelligence and Automated Processing
              </h2>
              <p>
                Our Service leverages advanced Artificial Intelligence (AI) and Natural Language Processing (NLP) technologies to transform unstructured data into structured contacts.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Extraction & Parsing: Our AI analyzes uploaded documents to identify entities such as names and emails.</li>
                <li>Probabilistic Matching: Enrichment involves matching your records against our database using probabilistic logic.</li>
                <li>No Automated Decision-Making: We do not use your personal data to make decisions with legal or similarly significant effects solely based on automated processing.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                5. Data Sharing and Disclosure
              </h2>
              <p>
                We respect the confidentiality of your data. We do not sell personal data to third parties for their independent marketing purposes. We share data only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Service Providers (Sub-Processors): We engage trusted third-party vendors for cloud hosting, AI processing, email delivery, and analytics.</li>
                <li>CRM Integrations: When you choose to sync data with third-party platforms like Salesforce or HubSpot, we transfer data at your direction.</li>
                <li>Legal Requirements: We may disclose information if required by law, subpoena, or court order.</li>
                <li>Corporate Transactions: In the event of a merger, acquisition, or sale of assets, user data may be transferred to the acquiring entity.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                6. International Data Transfers
              </h2>
              <p>
                If you access the Service from the European Economic Area (EEA), United Kingdom, or India, your data will be transferred to and processed in a jurisdiction that may have different data protection laws than your own. We safeguard these transfers using Standard Contractual Clauses (SCCs) and the EU-U.S. Data Privacy Framework.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                7. Your Rights and Choices
              </h2>
              <p>
                We provide robust rights to all users, regardless of location, aligning with the highest global standards.
              </p>

              <h3 className="text-xl font-semibold font-['Space_Grotesk'] mt-4 mb-2">
                7.1 Rights of Subscribers (Users)
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access & Correction: You can access and update your account information directly within the dashboard.</li>
                <li>Export: You can export your cleaned contact lists in CSV/Excel formats at any time.</li>
                <li>Deletion: You may delete your account and associated data via the settings menu.</li>
              </ul>

              <h3 className="text-xl font-semibold font-['Space_Grotesk'] mt-4 mb-2">
                7.2 Rights of Contacts (Enriched Profiles)
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Right to Know: Request details on what data we hold about you.</li>
                <li>Right to Opt-Out: Request removal of your profile from our enrichment database.</li>
                <li>Right to Correction: Request updates to outdated or incorrect professional details.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                8. Data Security and Retention
              </h2>
              <p>
                We employ enterprise-grade security measures to protect your data:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption: Data is encrypted in transit using TLS 1.2+ and at rest using AES-256 encryption.</li>
                <li>Access Control: Strict role-based access controls limit internal access to personal data to authorized personnel only.</li>
                <li>Vulnerability Management: We conduct regular penetration testing and security audits.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                9. Children's Privacy
              </h2>
              <p>
                Our Service is a B2B professional tool intended for use by businesses. We do not knowingly collect or solicit personal data from children under the age of 18.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                10. Updates to this Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our technology, legal requirements, or business operations. We will notify you of material changes via email or a prominent notice on our dashboard.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                11. Contact Us
              </h2>
              <p>
                If you have questions, concerns, or wish to exercise your rights, please contact us:
              </p>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="font-semibold">Privacy Team:</p>
                <p>Email: privacy@contactbuilder.com</p>
                <p className="mt-2 font-semibold">For Users in India (Grievance Officer):</p>
                <p>Email: grievance@contactbuilder.com</p>
              </div>
            </section>
          </div>

          <hr className="my-8 border-border" />

          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="mt-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  );
}
