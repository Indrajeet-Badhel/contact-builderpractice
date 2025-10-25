import fetch from 'node-fetch';

export interface EnrichmentSource {
  source: string;
  url: string;
  verified: boolean;
  data: any;
}

export interface EnrichedContactData {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  location?: string;
  skills?: string[];
  linkedinUrl?: string;
  githubUrl?: string;
  orcidUrl?: string;
  websiteUrl?: string;
  bio?: string;
  education?: any[];
  experience?: any[];
  publications?: any[];
  repositories?: any[];
  sources: EnrichmentSource[];
  confidenceScore: number;
}

export async function enrichContactFromGitHub(username: string, githubToken?: string): Promise<EnrichmentSource | null> {
  try {
    const headers: any = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Contact-Intelligence-App'
    };
    
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    const userResponse = await fetch(`https://api.github.com/users/${username}`, { headers });
    
    if (!userResponse.ok) {
      console.log(`GitHub user not found: ${username}`);
      return null;
    }

    const userData = await userResponse.json() as any;
    
    const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=10`, { headers });
    const repos = await reposResponse.json() as any;

    return {
      source: 'github',
      url: userData.html_url,
      verified: true,
      data: {
        name: userData.name,
        email: userData.email,
        company: userData.company,
        location: userData.location,
        bio: userData.bio,
        websiteUrl: userData.blog,
        followers: userData.followers,
        publicRepos: userData.public_repos,
        repositories: Array.isArray(repos) ? repos.map((repo: any) => ({
          name: repo.name,
          description: repo.description,
          language: repo.language,
          stars: repo.stargazers_count,
          url: repo.html_url,
          topics: repo.topics || []
        })) : [],
        skills: Array.isArray(repos) ? Array.from(new Set(repos
          .map((r: any) => r.language)
          .filter((lang: any) => lang !== null))) : []
      }
    };
  } catch (error) {
    console.error('Error enriching from GitHub:', error);
    return null;
  }
}

export async function enrichContactFromORCID(orcidId: string): Promise<EnrichmentSource | null> {
  try {
    const response = await fetch(`https://pub.orcid.org/v3.0/${orcidId}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`ORCID profile not found: ${orcidId}`);
      return null;
    }

    const data = await response.json() as any;
    const person = data.person;
    const activities = data['activities-summary'];

    const name = person?.name?.['given-names']?.value 
      ? `${person.name['given-names'].value} ${person.name['family-name']?.value || ''}`
      : undefined;

    const employments = activities?.employments?.['affiliation-group']?.map((group: any) => {
      const emp = group['summaries']?.[0]?.['employment-summary'];
      return emp ? {
        organization: emp['organization']?.name,
        role: emp['role-title'],
        startDate: emp['start-date']?.year?.value,
        endDate: emp['end-date']?.year?.value
      } : null;
    }).filter(Boolean) || [];

    const educations = activities?.educations?.['affiliation-group']?.map((group: any) => {
      const edu = group['summaries']?.[0]?.['education-summary'];
      return edu ? {
        institution: edu['organization']?.name,
        degree: edu['role-title'],
        year: edu['end-date']?.year?.value
      } : null;
    }).filter(Boolean) || [];

    return {
      source: 'orcid',
      url: `https://orcid.org/${orcidId}`,
      verified: true,
      data: {
        name,
        orcidId,
        employments,
        educations,
        bio: person?.biography?.content
      }
    };
  } catch (error) {
    console.error('Error enriching from ORCID:', error);
    return null;
  }
}

export async function searchGitHubByEmail(email: string, githubToken?: string): Promise<string | null> {
  try {
    const headers: any = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Contact-Intelligence-App'
    };
    
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    const response = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(email)}`, { headers });
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    if (data.items && data.items.length > 0) {
      return data.items[0].login;
    }
    
    return null;
  } catch (error) {
    console.error('Error searching GitHub by email:', error);
    return null;
  }
}

export async function searchORCIDByName(name: string): Promise<string | null> {
  try {
    const response = await fetch(`https://pub.orcid.org/v3.0/search/?q=${encodeURIComponent(name)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    if (data.result && data.result.length > 0 && data.result[0]['orcid-identifier']) {
      return data.result[0]['orcid-identifier'].path;
    }
    
    return null;
  } catch (error) {
    console.error('Error searching ORCID by name:', error);
    return null;
  }
}

function extractGitHubUsername(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/github\.com\/([^\/]+)/);
  return match ? match[1] : null;
}

function extractORCIDId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])/);
  return match ? match[1] : null;
}

export async function enrichContact(
  extractedData: any,
  githubToken?: string
): Promise<EnrichedContactData> {
  const sources: EnrichmentSource[] = [];
  const allData: any = { ...extractedData };

  let githubUsername = extractGitHubUsername(extractedData.githubUrl);
  
  if (!githubUsername && extractedData.email) {
    githubUsername = await searchGitHubByEmail(extractedData.email, githubToken);
  }

  if (githubUsername) {
    const githubData = await enrichContactFromGitHub(githubUsername, githubToken);
    if (githubData) {
      sources.push(githubData);
      
      allData.name = allData.name || githubData.data.name;
      allData.email = allData.email || githubData.data.email;
      allData.company = allData.company || githubData.data.company;
      allData.location = allData.location || githubData.data.location;
      allData.bio = allData.bio || githubData.data.bio;
      allData.websiteUrl = allData.websiteUrl || githubData.data.websiteUrl;
      allData.githubUrl = githubData.url;
      allData.repositories = githubData.data.repositories;
      
      const githubSkills = githubData.data.skills || [];
      allData.skills = Array.from(new Set([...(allData.skills || []), ...githubSkills]));
    }
  }

  let orcidId = extractORCIDId(extractedData.orcidUrl);
  
  if (!orcidId && extractedData.name) {
    orcidId = await searchORCIDByName(extractedData.name);
  }

  if (orcidId) {
    const orcidData = await enrichContactFromORCID(orcidId);
    if (orcidData) {
      sources.push(orcidData);
      
      allData.name = allData.name || orcidData.data.name;
      allData.bio = allData.bio || orcidData.data.bio;
      allData.orcidUrl = orcidData.url;
      
      if (orcidData.data.employments && orcidData.data.employments.length > 0) {
        const latestEmployment = orcidData.data.employments[0];
        allData.company = allData.company || latestEmployment.organization;
        allData.title = allData.title || latestEmployment.role;
      }
      
      if (orcidData.data.educations) {
        allData.education = [...(allData.education || []), ...orcidData.data.educations];
      }
    }
  }

  const documentSource = {
    source: 'document',
    url: 'uploaded_document',
    verified: false,
    data: extractedData
  };
  sources.unshift(documentSource);

  const confidenceScore = calculateConfidenceScore(sources, allData);

  return {
    ...allData,
    sources: sources.map(s => ({
      source: s.source,
      url: s.url,
      verified: s.verified
    })),
    confidenceScore
  };
}

function calculateConfidenceScore(sources: EnrichmentSource[], data: any): number {
  let score = 0.5;
  
  const verifiedSourcesCount = sources.filter(s => s.verified).length;
  score += verifiedSourcesCount * 0.15;
  
  const fieldCoverage = [
    data.name, data.email, data.phone, data.company, 
    data.title, data.location, data.bio
  ].filter(Boolean).length / 7;
  score += fieldCoverage * 0.2;
  
  if (data.email) score += 0.05;
  if (data.phone) score += 0.05;
  if (data.githubUrl) score += 0.05;
  if (data.linkedinUrl) score += 0.05;
  if (data.orcidUrl) score += 0.05;
  
  return Math.min(score, 1.0);
}
