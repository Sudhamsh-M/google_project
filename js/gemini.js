/* ============================================
   AEGIS — Gemini AI Decision Support
   ============================================ */

const GeminiAI = {
  endpoint: 'http://localhost:8000/api/decision',
  async requestDecision(incident) {
    if (!incident) return null;

    if (!incident.aiDecision) {
      incident.aiDecision = 'Loading AI recommendation...';
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ incident }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned ${response.status}`);
      }

      const data = await response.json();
      const decision = data?.decision || data?.result || null;
      incident.aiDecision = decision || this.fallbackRecommendation(incident);
    } catch (error) {
      console.warn('GeminiAI request failed:', error);
      incident.aiDecision = this.fallbackRecommendation(incident);
    }

    EventBus.emit('ai-decision', incident);
    return incident.aiDecision;
  },

  buildPrompt(incident) {
    const summary = [
      `Incident ID: ${incident.id}`,
      `Type: ${INCIDENT_TYPES[incident.type]?.label || incident.type}`,
      `Severity: ${incident.severity}`,
      `Location: ${incident.location}`,
      `Status: ${incident.status}`,
      `Reported By: ${incident.reportedBy || 'Unknown'}`,
      `Description: ${incident.description || 'No description provided.'}`,
    ].join('\n');

    return `You are an emergency response coordinator for a large hospitality venue. Based on the incident details below, provide a concise response plan in bullet points. Recommend immediate actions, the team(s) to assign, and any escalation steps if needed.\n\n${summary}`;
  },

  fallbackRecommendation(incident) {
    const type = incident.type;
    const severity = incident.severity;

    const recommendations = {
      fire: [
        'Notify fire department and evacuate the immediate area.',
        'Open emergency exits and keep guests clear of the kitchen.',
        'Assign security to manage crowd control and confirm fire suppression status.',
      ],
      medical: [
        'Keep the patient stable and request paramedics immediately.',
        'Prepare a stretcher and clear a path to the ambulance entrance.',
        'Have nearby staff monitor vitals until EMS arrives.',
      ],
      security: [
        'Lock down the affected access point and verify personnel credentials.',
        'Dispatch security officers to the location and review camera footage.',
        'Prepare a containment perimeter and notify management.',
      ],
      suspicious: [
        'Secure the area and keep guests away from the object or person.',
        'Notify bomb squad or specialized response as appropriate.',
        'Gather witness statements and preserve the scene.',
      ],
      utility: [
        'Contact engineering immediately and isolate the affected system.',
        'Notify impacted guests or staff and reroute services if needed.',
        'Verify whether any evacuation or lockdown is required.',
      ],
      distress: [
        'Assign a security escort and provide support to the distressed guest.',
        'Document the report and monitor the area for follow-up.',
        'Notify management and prepare for a safe room change if needed.',
      ],
    };

    const fallback = recommendations[type] || [
      'Review the incident details and assign the appropriate response team.',
      'Keep the area secure and communicate clearly with on-site staff.',
      'Escalate to management if the situation worsens.',
    ];

    if (severity === 'critical' && !fallback.some(line => line.toLowerCase().includes('immediately'))) {
      fallback.unshift('Take immediate action and escalate to emergency services.');
    }

    return fallback.join('\n');
  },
};
