import type { Course, Prerequisite } from '../src/data/catalog-schema.ts'
import { chemistryUnresolvedReasons } from './chemistry-prerequisite-reviews.ts'

// Reviewed against the saved catalog-37 panels on October 14, 2026.
// Exact source-text guards apply to resolved AND unresolved interpretations.
// BIOL 3308 explicitly says Genetics AND laboratory. BIOL 4320 explicitly
// excludes recommended CHEM 2301 from requirements. CHEM 4344's trailing
// introductory sentence is descriptive; its source text remains intact.
const reviews: Record<string, { expectedText: string; prerequisites?: Prerequisite; reason?: string }> = {
  "MBIO 2305": {
    "expectedText": "BIOL 1302/BIOL 1102 and CHEM 1308/CHEM 1108 and credit or enrollment in MBIO 2105.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "MBIO 2105": {
    "expectedText": "Credit or enrollment in MBIO 2305.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:MBIO 2305",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 2303": {
    "expectedText": "BIOL 1302/BIOL 1102,CHEM 1308/CHEM 1108, and credit or enrollment in BIOL 2103.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 2103": {
    "expectedText": "BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108, and credit or enrollment in BIOL 2303.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 3306": {
    "expectedText": "BIOL 2303.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 2303",
      "timing": "before"
    }
  },
  "BIOL 4311": {
    "expectedText": "Senior standing and majoring in an area of life science.",
    "prerequisites": {
      "kind": "all",
      "items": [
        {
          "kind": "condition",
          "category": "standing",
          "text": "Senior standing"
        },
        {
          "kind": "condition",
          "category": "other",
          "text": "Majoring in an area of life science"
        }
      ]
    }
  },
  "MBIO 4311": {
    "expectedText": "MBIO 2305/MBIO 2105 and 8 hours of upper-level science.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "SUST 4301": {
    "expectedText": "Senior standing.",
    "prerequisites": {
      "kind": "condition",
      "category": "standing",
      "text": "Senior standing"
    }
  },
  "BIOL 3300": {
    "expectedText": "Approval by the Natural Sciences Department, minimum GPA of 2.0, and permission of instructor.",
    "prerequisites": {
      "kind": "all",
      "items": [
        {
          "kind": "condition",
          "category": "permission",
          "text": "Approval by the Natural Sciences Department"
        },
        {
          "kind": "condition",
          "category": "other",
          "text": "Minimum GPA of 2.0"
        },
        {
          "kind": "condition",
          "category": "permission",
          "text": "Permission of instructor"
        }
      ]
    }
  },
  "BIOL 4302": {
    "expectedText": "BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108, and 4 hours of biology above the 1000-level.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 4331": {
    "expectedText": "One of the following: BIOL 4320, BIOL 4330, CHEM 4140, MBIO 4310",
    "reason": "MBIO 4310 is absent from the available same-edition records. Retain the full OR choice until that reference is resolved."
  },
  "BIOL 4332": {
    "expectedText": "BIOL 3103 or CHEM 4140",
    "reason": "BIOL 3103 is absent from the available same-edition records. Do not replace it with BIOL 2103 without evidence."
  },
  "BIOL 4361": {
    "expectedText": "BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108 and 4 hours of biology above the 1000-level.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 3102": {
    "expectedText": "Credit or enrollment in BIOL 3302.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 3302",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 3104": {
    "expectedText": "Credit or enrollment in BIOL 3304.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 3304",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 3107": {
    "expectedText": "Enrollment or credit in BIOL 3307",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 3307",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 4110": {
    "expectedText": "Credit or enrollment in BIOL 4310.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 4310",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 3308": {
    "expectedText": "General Genetics and laboratory (BIOL 2303/BIOL 2103)",
    "prerequisites": {
      "kind": "all",
      "items": [
        {
          "kind": "course",
          "courseId": "2025-2026:BIOL 2303",
          "timing": "before"
        },
        {
          "kind": "course",
          "courseId": "2025-2026:BIOL 2103",
          "timing": "before"
        }
      ]
    }
  },
  "BIOL 4320": {
    "expectedText": "BIOL 2303and 6 hours of upper-level biology; credit for CHEM 2301 is recommended but not required.",
    "prerequisites": {
      "kind": "all",
      "items": [
        {
          "kind": "course",
          "courseId": "2025-2026:BIOL 2303",
          "timing": "before"
        },
        {
          "kind": "condition",
          "category": "other",
          "text": "6 hours of upper-level biology"
        }
      ]
    }
  },
  "BIOL 4330": {
    "expectedText": "Credit for BIOL 2303/BIOL 2103 and senior standing; credit for CHEM 2301/CHEM 2101 is recommended but not required.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 4344": {
    "expectedText": "CHEM 4340.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:CHEM 4340",
      "timing": "before"
    }
  },
  "CHEM 4344": {
    "expectedText": "CHEM 4340. Introduction to fundamental principles in pharmacology and toxicology.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:CHEM 4340",
      "timing": "before"
    }
  },
  "MBIO 3390": {
    "expectedText": "",
    "reason": "No prerequisite statement is published in the captured panel; absence is not evidence of no prerequisites."
  },
  "MBIO 4320": {
    "expectedText": "A grade of C or better in MBIO 2305/MBIO 2105, BIOL 2303/BIOL 2103, and credit or concurrent enrollment in MBIO 4120.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "MBIO 4120": {
    "expectedText": "Credit or enrollment in MBIO 4320.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:MBIO 4320",
      "timing": "before-or-concurrent"
    }
  },
  "MBIO 4330": {
    "expectedText": "BIOL 2303/BIOL 2103, MBIO 2305/MBIO 2105.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "MBIO 4390": {
    "expectedText": "Varies according to topic.",
    "reason": "Prerequisites vary by topic; no specific offering requirements are supplied."
  },
  "BIOL 3330": {
    "expectedText": "BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108, and credit or enrollment in BIOL 3130.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 3130": {
    "expectedText": "Credit or enrollment in BIOL 3330.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 3330",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 3310": {
    "expectedText": "BIOL 1302/BIOL 1102 and credit or enrollment in BIOL 3110.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 3110": {
    "expectedText": "Credit or enrollment in BIOL 3310.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 3310",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 3340": {
    "expectedText": "BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108 or credit or enrollment in BIOL 3140.",
    "reason": "Slash grouping and the OR scope of credit or enrollment in BIOL 3140 require clarification."
  },
  "BIOL 3140": {
    "expectedText": "Credit or enrollment in BIOL 3340.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 3340",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 3302": {
    "expectedText": "BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108 and enrollment or credit in BIOL 3102.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 4360": {
    "expectedText": "BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108, and 4 hours of biology above the 1000-level.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 4340": {
    "expectedText": "BIOL 1302/BIOL 1102 and ENG 1302.",
    "reason": "Slash grouping is unresolved and ENG 1302 has no captured record; do not infer a course-code equivalency."
  },
  "BIOL 4350": {
    "expectedText": "8 hours of biology, ENG 1302, PSY 1303 or SOC 1303, and junior standing.",
    "reason": "ENG 1302, PSY 1303 and SOC 1303 lack captured records; preserve the alternatives and standing/credit conditions without guessed aliases."
  },
  "MBIO 3340": {
    "expectedText": "Grade of C or better in MBIO 2305/MBIO 2105.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 3105": {
    "expectedText": "Credit or enrollment in BIOL 3305.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 3305",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 3304": {
    "expectedText": "BIOL 2303/BIOL 2103 and credit or enrollment in BIOL 3104.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 3305": {
    "expectedText": "8 hours of biology,CHEM 1308/CHEM 1108, and enrollment in BIOL 3105.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 3307": {
    "expectedText": "BIOL 1302/BIOL 1102; CHEM 1308/CHEM 1108; enrollment or credit in BIOL 3107.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 3320": {
    "expectedText": "8 hours of biology, CHEM 1308/CHEM 1108.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 4303": {
    "expectedText": "BIOL 2303/BIOL 2103.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 4310": {
    "expectedText": "BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108, and credit or enrollment in BIOL 4110.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 4313": {
    "expectedText": "BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108, and credit or enrollment in BIOL 4113.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "BIOL 4113": {
    "expectedText": "Credit or enrollment in BIOL 4313.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:BIOL 4313",
      "timing": "before-or-concurrent"
    }
  },
  "BIOL 4305": {
    "expectedText": "BIOL 1302 and CHEM 2301.",
    "prerequisites": {
      "kind": "all",
      "items": [
        {
          "kind": "course",
          "courseId": "2025-2026:BIOL 1302",
          "timing": "before"
        },
        {
          "kind": "course",
          "courseId": "2025-2026:CHEM 2301",
          "timing": "before"
        }
      ]
    }
  },
  "MBIO 3320": {
    "expectedText": "MBIO 2305/MBIO 2105.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "MBIO 4340": {
    "expectedText": "A grade of C or better in MBIO 2305/MBIO 2105, BIOL 2303/BIOL 2103 and credit or enrollment in MBIO 4140.",
    "reason": "Slash-separated course pairs do not explicitly specify AND or OR. Retain the complete statement without partial prerequisite edges."
  },
  "MBIO 4140": {
    "expectedText": "Credit or enrollment in MBIO 4340.",
    "prerequisites": {
      "kind": "course",
      "courseId": "2025-2026:MBIO 4340",
      "timing": "before-or-concurrent"
    }
  }
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

export function reviewBiologyPrerequisites(courses: Course[], shared: Map<string, Course>) {
  const unresolved: { courseId: string; reason: string }[] = []
  const reusedReviewIds: string[] = []
  const reviewed = courses.map(course => {
    if (course.catalogYear !== '2025-2026' || course.id !== '2025-2026:' + course.code)
      throw new Error('Biology review requires catalog 2025-2026 and matching identities')
    const prior = shared.get(course.code)
    if (prior) {
      if (prior.catalogYear !== course.catalogYear || prior.id !== course.id ||
          normalize(prior.prerequisiteText) !== normalize(course.prerequisiteText))
        throw new Error('Shared prerequisite source changed; re-review ' + course.code)
      if (prior.review === 'verified') {
        reusedReviewIds.push(course.id)
        return { ...course, review: 'verified' as const, prerequisites: structuredClone(prior.prerequisites) }
      }
      const reason = chemistryUnresolvedReasons[course.code]
      if (!reason) throw new Error('Missing shared Biology review: ' + course.code)
      unresolved.push({ courseId: course.id, reason })
    } else {
      const review = reviews[course.code]
      if (!review) throw new Error('Missing Biology review: ' + course.code)
      if (normalize(course.prerequisiteText) !== normalize(review.expectedText))
        throw new Error('Prerequisite source changed; re-review ' + course.code)
      if (review.prerequisites)
        return { ...course, review: 'verified' as const, prerequisites: structuredClone(review.prerequisites) }
      if (!review.reason) throw new Error('Missing Biology review reason: ' + course.code)
      unresolved.push({ courseId: course.id, reason: review.reason })
    }
    return { ...course, review: 'needs-review' as const, prerequisites: { kind: 'condition' as const,
      category: 'other' as const, text: course.prerequisiteText || 'No prerequisite statement published; review required.' } }
  })
  return { courses: reviewed, unresolved, reusedReviewIds }
}
