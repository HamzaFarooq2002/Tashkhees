import type { RubricDef } from "./types";

/**
 * Tashkhees scoring Key, version 1.
 *
 * This is the single source of truth for the rubric: the seed script writes
 * these values into the database, and the scoring engine only ever reads
 * resolved configuration back out of the database at evaluation time. This
 * file must never be imported by runtime scoring/rendering code directly -
 * only by the seed script and by tests that check the seeded Key matches
 * the specification.
 */
export const RUBRIC_V1: RubricDef = {
  version: 1,
  label: "Tashkhees Scoring Key v1",
  statusOptions: [
    { key: "fully_implemented", label: "Fully Implemented", score: 5 },
    { key: "partially_implemented", label: "Partially Implemented", score: 3 },
    { key: "fragmented_uneven", label: "Fragmented/Uneven", score: 2 },
    { key: "absent", label: "Absent", score: 0 },
  ],
  categories: [
    {
      key: "technical",
      name: "Technical Parameters",
      weight: 0.4,
      parameters: [
        {
          key: "messaging_standards",
          name: "Messaging Standards",
          weight: 0.25,
          inputType: "STANDARD",
          standardOptions: [
            { key: "iso20022", label: "ISO 20022", multiplier: 1.0 },
            { key: "iso8583", label: "ISO 8583", multiplier: 0.75 },
            { key: "iso15022", label: "ISO 15022", multiplier: 0.4 },
            { key: "local_proprietary", label: "Local/Proprietary", multiplier: 0.1 },
            { key: "no_standard", label: "No Standard", multiplier: 0 },
          ],
        },
        {
          key: "strong_customer_authentication",
          name: "Strong Customer Authentication",
          weight: 0.2,
          inputType: "STANDARD",
          standardOptions: [
            { key: "psd2", label: "PSD2", multiplier: 1.0 },
            { key: "emv_3ds", label: "EMV 3-D Secure (3DS)", multiplier: 0.8 },
            { key: "fido2_webauthn", label: "FIDO2/WebAuthn", multiplier: 0.65 },
            { key: "otp_sms_2fa", label: "OTP/SMS 2FA", multiplier: 0.4 },
            { key: "sso", label: "SSO", multiplier: 0.5 },
            { key: "no_sca", label: "No SCA", multiplier: 0 },
          ],
        },
        {
          key: "apis_for_payments",
          name: "APIs for Payments",
          weight: 0.13,
          inputType: "STANDARD",
          standardOptions: [
            { key: "open_banking_apis", label: "Open Banking APIs", multiplier: 1.0 },
            { key: "proprietary_bank_apis", label: "Proprietary Bank APIs", multiplier: 0.7 },
            { key: "api_aggregators_middleware", label: "API Aggregators/Middleware", multiplier: 0.6 },
            { key: "file_based_legacy_h2h", label: "File-based/Legacy Host-to-Host", multiplier: 0.4 },
            { key: "none", label: "None", multiplier: 0 },
          ],
        },
        {
          key: "payments_network_connectivity",
          name: "Payments Network Connectivity",
          weight: 0.15,
          inputType: "STANDARD",
          standardOptions: [
            { key: "openloop_instant_payments", label: "Openloop Instant Payments", multiplier: 1.0 },
            { key: "interoperable_rtgs", label: "Interoperable RTGS", multiplier: 0.8 },
            { key: "regional_cross_border", label: "Regional Cross-border", multiplier: 0.75 },
            { key: "national_payment_switches", label: "National Payment Switches", multiplier: 0.7 },
            { key: "closed_loop", label: "Closed Loop", multiplier: 0.4 },
            { key: "none", label: "None", multiplier: 0 },
          ],
        },
        {
          key: "overlay_services",
          name: "Overlay Services",
          weight: 0.1,
          inputType: "STANDARD",
          standardOptions: [
            {
              key: "alias_qr_rtp_mandates",
              label: "Alias Directory+QR+Request-to-Pay+Mandates",
              multiplier: 1.0,
            },
            { key: "two_overlays", label: "Two Overlays", multiplier: 0.8 },
            { key: "single_overlay", label: "Single Overlay", multiplier: 0.5 },
            { key: "fragmented_pilot", label: "Fragmented/Pilot", multiplier: 0.2 },
            { key: "none", label: "None", multiplier: 0 },
          ],
        },
        {
          key: "access_channels",
          name: "Access Channels",
          weight: 0.17,
          inputType: "SUBPARAM",
          subParameters: [
            { key: "mobile_banking", label: "Mobile Banking", contributorWeight: 0.4 },
            { key: "internet_banking", label: "Internet Banking", contributorWeight: 0.2 },
            { key: "ussd", label: "USSD", contributorWeight: 0.1 },
            { key: "atm", label: "ATM", contributorWeight: 0.1 },
            { key: "branches", label: "Branches", contributorWeight: 0.2 },
          ],
        },
      ],
    },
    {
      key: "operational",
      name: "Operational Parameters",
      weight: 0.35,
      parameters: [
        {
          key: "clearing_settlement",
          name: "Clearing & Settlement",
          weight: 0.2,
          inputType: "STANDARD",
          standardOptions: [
            { key: "real_time", label: "Real-time", multiplier: 1.0 },
            { key: "same_day", label: "Same Day", multiplier: 0.8 },
            { key: "next_day", label: "Next Day", multiplier: 0.5 },
            { key: "fragmented_manual", label: "Fragmented/Manual", multiplier: 0.3 },
            { key: "none", label: "None", multiplier: 0 },
          ],
        },
        {
          key: "interoperability",
          name: "Interoperability",
          weight: 0.2,
          inputType: "SUBPARAM",
          subParameters: [
            { key: "bank_to_bank", label: "Bank to Bank", contributorWeight: 0.25 },
            { key: "banks_non_banks", label: "Banks–Non-Banks", contributorWeight: 0.25 },
            { key: "qr", label: "QR", contributorWeight: 0.2 },
            { key: "cards", label: "Cards", contributorWeight: 0.15 },
            { key: "gateway", label: "Gateway", contributorWeight: 0.1 },
            { key: "rtp", label: "RTP", contributorWeight: 0.05 },
          ],
        },
        {
          key: "use_cases_services_enabled",
          name: "Use Cases / Services Enabled",
          weight: 0.2,
          inputType: "SUBPARAM",
          subParameters: [
            { key: "p2p", label: "P2P", contributorWeight: 0.2 },
            { key: "p2m", label: "P2M", contributorWeight: 0.2 },
            { key: "p2g", label: "P2G", contributorWeight: 0.1 },
            { key: "g2p", label: "G2P", contributorWeight: 0.1 },
            { key: "g2g", label: "G2G", contributorWeight: 0.05 },
            { key: "b2b", label: "B2B", contributorWeight: 0.15 },
            { key: "b2c", label: "B2C", contributorWeight: 0.15 },
            { key: "b2g", label: "B2G", contributorWeight: 0.02 },
            { key: "c2b", label: "C2B", contributorWeight: 0.03 },
          ],
        },
        {
          key: "legal_regulatory",
          name: "Legal & Regulatory",
          weight: 0.15,
          inputType: "SUBPARAM",
          subParameters: [
            { key: "digital_banking_licenses", label: "Digital Banking Licenses", contributorWeight: 0.25 },
            { key: "digital_merchant_onboarding", label: "Digital Merchant Onboarding", contributorWeight: 0.2 },
            { key: "specialised_merchant_limits", label: "Specialised Merchant Limits", contributorWeight: 0.2 },
            { key: "centrally_owned_rails", label: "Centrally owned rails", contributorWeight: 0.35 },
          ],
        },
        {
          key: "risk_management",
          name: "Risk Management",
          weight: 0.1,
          inputType: "SUBPARAM",
          subParameters: [
            { key: "aml_checks", label: "AML Checks", contributorWeight: 0.25 },
            { key: "cft_checks", label: "CFT Checks", contributorWeight: 0.25 },
            { key: "fraud_monitoring_systems", label: "Fraud Monitoring Systems", contributorWeight: 0.1 },
            { key: "cybersecurity_data_protection", label: "Cybersecurity & Data Protection", contributorWeight: 0.15 },
            { key: "transaction_limits_tiered_kyc", label: "Transaction Limits & Tiered KYC", contributorWeight: 0.25 },
          ],
        },
        {
          key: "dispute_resolution",
          name: "Dispute Resolution",
          weight: 0.1,
          inputType: "SUBPARAM",
          subParameters: [
            {
              key: "centralized_dispute_resolution_mechanism",
              label: "Centralized Dispute Resolution Mechanism",
              contributorWeight: 0.8,
            },
            { key: "defined_chargeback_rules", label: "Defined Chargeback Rules", contributorWeight: 0.2 },
          ],
        },
        {
          key: "decentralized_ownership",
          name: "Decentralized Ownership",
          weight: 0.05,
          inputType: "SUBPARAM",
          subParameters: [
            { key: "independent_arbitration_ombudsman", label: "Independent Arbitration/Ombudsman", contributorWeight: 0.2 },
            { key: "multi_stakeholder_governance", label: "Multi-Stakeholder Governance", contributorWeight: 0.2 },
            { key: "ppp_operator_model", label: "Public-Private Partnership Operator Model", contributorWeight: 0.2 },
            { key: "open_participation_rules", label: "Open Participation Rules", contributorWeight: 0.4 },
          ],
        },
      ],
    },
    {
      key: "financial_inclusion",
      name: "Financial Inclusion Parameters",
      weight: 0.25,
      parameters: [
        {
          key: "multiple_banks_incl_mfbs",
          name: "Multiple Banks incl. MFBs",
          weight: 0.1,
          inputType: "SUBPARAM",
          subParameters: [
            { key: "commercial_banks", label: "Commercial Banks", contributorWeight: 0.2 },
            { key: "digital_banks", label: "Digital Banks", contributorWeight: 0.3 },
            { key: "wallets", label: "Wallets", contributorWeight: 0.2 },
            { key: "pisps", label: "PISPS", contributorWeight: 0.15 },
            { key: "psos", label: "PSOS", contributorWeight: 0.15 },
          ],
        },
        {
          key: "financial_inclusion",
          name: "Financial Inclusion",
          weight: 0.15,
          inputType: "BANDED",
          bands: [
            { lower: 90, upper: 100, upperInclusive: true, multiplier: 1.0 },
            { lower: 80, upper: 90, upperInclusive: false, multiplier: 0.9 },
            { lower: 50, upper: 80, upperInclusive: false, multiplier: 0.6 },
            { lower: 20, upper: 50, upperInclusive: false, multiplier: 0.3 },
            { lower: 0, upper: 20, upperInclusive: false, multiplier: 0.1 },
          ],
        },
        {
          key: "gender_inclusion",
          name: "Gender Inclusion",
          weight: 0.05,
          inputType: "BANDED",
          bands: [
            { lower: 45, upper: 100, upperInclusive: true, multiplier: 1.0 },
            { lower: 35, upper: 45, upperInclusive: false, multiplier: 0.8 },
            { lower: 15, upper: 35, upperInclusive: false, multiplier: 0.4 },
            { lower: 0, upper: 15, upperInclusive: false, multiplier: 0.1 },
          ],
        },
        {
          key: "internet_penetration",
          name: "Internet Penetration",
          weight: 0.15,
          inputType: "BANDED",
          bands: [
            { lower: 70, upper: 100, upperInclusive: true, multiplier: 1.0 },
            { lower: 60, upper: 70, upperInclusive: false, multiplier: 0.8 },
            { lower: 50, upper: 60, upperInclusive: false, multiplier: 0.7 },
            { lower: 40, upper: 50, upperInclusive: false, multiplier: 0.55 },
            { lower: 30, upper: 40, upperInclusive: false, multiplier: 0.4 },
            { lower: 0, upper: 30, upperInclusive: false, multiplier: 0.25 },
          ],
        },
        {
          key: "mobile_penetration",
          name: "Mobile Penetration",
          weight: 0.15,
          inputType: "SPLIT_BANDED",
          subMetrics: [
            {
              key: "smartphone",
              label: "Smartphone Penetration",
              splitWeight: 0.65,
              bands: [
                { lower: 60, upper: 100, upperInclusive: true, multiplier: 1.0 },
                { lower: 40, upper: 60, upperInclusive: false, multiplier: 0.9 },
                { lower: 30, upper: 40, upperInclusive: false, multiplier: 0.6 },
                { lower: 20, upper: 30, upperInclusive: false, multiplier: 0.3 },
                { lower: 0, upper: 20, upperInclusive: false, multiplier: 0.1 },
              ],
            },
            {
              key: "feature_phone",
              label: "Feature-phone Penetration",
              splitWeight: 0.35,
              bands: [
                { lower: 30, upper: 100, upperInclusive: true, multiplier: 1.0 },
                { lower: 20, upper: 30, upperInclusive: false, multiplier: 0.8 },
                { lower: 10, upper: 20, upperInclusive: false, multiplier: 0.6 },
                { lower: 0, upper: 10, upperInclusive: false, multiplier: 0.4 },
              ],
            },
          ],
        },
        {
          key: "unique_citizen_id",
          name: "Unique Citizen ID",
          weight: 0.2,
          inputType: "BOOLEAN",
          booleanYesMultiplier: 1.0,
          booleanNoMultiplier: 0,
        },
        {
          key: "cash_dominance",
          name: "Cash Dominance",
          weight: 0.1,
          inputType: "BANDED",
          bands: [
            { lower: 0, upper: 5, upperInclusive: false, multiplier: 1.0 },
            { lower: 5, upper: 10, upperInclusive: false, multiplier: 0.9 },
            { lower: 10, upper: 15, upperInclusive: false, multiplier: 0.7 },
            { lower: 15, upper: 100, upperInclusive: true, multiplier: 0.2 },
          ],
        },
        {
          key: "consumer_behavior",
          name: "Consumer Behavior",
          weight: 0.1,
          inputType: "SPLIT_BANDED",
          subMetrics: [
            {
              key: "digital_transactions",
              label: "Digital Transactions",
              splitWeight: 0.4,
              bands: [
                { lower: 40, upper: 100, upperInclusive: true, multiplier: 1.0 },
                { lower: 20, upper: 40, upperInclusive: false, multiplier: 0.8 },
                { lower: 15, upper: 20, upperInclusive: false, multiplier: 0.6 },
                { lower: 10, upper: 15, upperInclusive: false, multiplier: 0.4 },
                { lower: 0, upper: 10, upperInclusive: false, multiplier: 0.2 },
              ],
            },
            {
              key: "youth_population",
              label: "Youth Population",
              splitWeight: 0.3,
              bands: [
                { lower: 60, upper: 100, upperInclusive: true, multiplier: 1.0 },
                { lower: 50, upper: 60, upperInclusive: false, multiplier: 0.8 },
                { lower: 40, upper: 50, upperInclusive: false, multiplier: 0.6 },
                { lower: 0, upper: 40, upperInclusive: false, multiplier: 0.2 },
              ],
            },
            {
              key: "literacy_rate",
              label: "Literacy Rate",
              splitWeight: 0.3,
              bands: [
                { lower: 90, upper: 100, upperInclusive: true, multiplier: 1.0 },
                { lower: 70, upper: 90, upperInclusive: false, multiplier: 0.8 },
                { lower: 60, upper: 70, upperInclusive: false, multiplier: 0.6 },
                { lower: 0, upper: 60, upperInclusive: false, multiplier: 0.4 },
              ],
            },
          ],
        },
      ],
    },
  ],
};
