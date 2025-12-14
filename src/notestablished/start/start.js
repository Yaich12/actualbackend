// app/launch-planner/page.tsx (eller hvor du nu lægger den)
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, HelpCircle } from "lucide-react"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { Input } from "../../components/ui/input"
import { Textarea } from "../../components/ui/textarea"
import { Label } from "../../components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../../components/ui/select"
import { Checkbox } from "../../components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip"

const STEPS = [
  "Starting point",
  "Niche & audience",
  "Services & pricing",
  "Business setup",
  "First patients",
  "Summary",
] 

export function LaunchPlannerPage() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const navigate = useNavigate()

  /**
   * @typedef {Object} StartingPoint
   * @property {string} profession
   * @property {string} experienceLevel
   * @property {string[]} primaryMotivations
   * @property {string} lifestyleGoal
   *
   * @typedef {Object} NicheAudience
   * @property {string} primaryNiche
   * @property {string[]} problemTypes
   * @property {string} idealPatient
   * @property {string} workMode
   *
   * @typedef {Object} ServicesPricing
   * @property {string} coreServiceName
   * @property {string} coreServiceDescription
   * @property {string} coreServicePrice
   * @property {string} packageName
   * @property {string} packageDescription
   * @property {string} packagePrice
   * @property {string} incomeGoal
   *
   * @typedef {"simple" | "liability" | "multi" | ""} RegisterPreference
   * @typedef {Object} BusinessSetup
   * @property {string} stage
   * @property {RegisterPreference} registerPreference
   * @property {string} legalStructure
   * @property {boolean} hasDocumentationPlan
   * @property {boolean} hasInsurancePlan
   * @property {boolean} hasDataPrivacyPlan
   * @property {boolean} hasPaymentSetup
   * @property {string[]} unsureAreas
   *
   * @typedef {Object} FirstPatients
   * @property {string} chosenChannel
   * @property {string[]} otherChannels
   * @property {string} introMessage
   */

  const [startingPoint, setStartingPoint] = useState({
    profession: "",
    experienceLevel: "",
    primaryMotivations: [],
    lifestyleGoal: "",
  })

  const [nicheAudience, setNicheAudience] = useState({
    primaryNiche: "",
    problemTypes: [],
    idealPatient: "",
    workMode: "",
  })

  const [servicesPricing, setServicesPricing] = useState({
    coreServiceName: "",
    coreServiceDescription: "",
    coreServicePrice: "",
    packageName: "",
    packageDescription: "",
    packagePrice: "",
    incomeGoal: "",
  })

  const [businessSetup, setBusinessSetup] = useState({
    stage: "",
    registerPreference: "",
    legalStructure: "",
    hasDocumentationPlan: false,
    hasInsurancePlan: false,
    hasDataPrivacyPlan: false,
    hasPaymentSetup: false,
    unsureAreas: [],
  })

  const [firstPatients, setFirstPatients] = useState({
    chosenChannel: "",
    otherChannels: [],
    introMessage: "",
  })

  const toggleMotivation = (value) => {
    setStartingPoint((prev) => {
      const exists = prev.primaryMotivations.includes(value)
      return {
        ...prev,
        primaryMotivations: exists
          ? prev.primaryMotivations.filter((m) => m !== value)
          : [...prev.primaryMotivations, value],
      }
    })
  }

  const toggleProblemType = (value) => {
    setNicheAudience((prev) => {
      const exists = prev.problemTypes.includes(value)
      return {
        ...prev,
        problemTypes: exists
          ? prev.problemTypes.filter((m) => m !== value)
          : [...prev.problemTypes, value],
      }
    })
  }

  const toggleUnsureArea = (value) => {
    setBusinessSetup((prev) => {
      const exists = prev.unsureAreas.includes(value)
      return {
        ...prev,
        unsureAreas: exists
          ? prev.unsureAreas.filter((m) => m !== value)
          : [...prev.unsureAreas, value],
      }
    })
  }

  const toggleOtherChannel = (value) => {
    setFirstPatients((prev) => {
      const exists = prev.otherChannels.includes(value)
      return {
        ...prev,
        otherChannels: exists
          ? prev.otherChannels.filter((m) => m !== value)
          : [...prev.otherChannels, value],
      }
    })
  }

  const currentStep = STEPS[currentStepIndex]
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100

  const goNext = () => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1))
  }

  const goBack = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0))
  }

  return (
    <div className="w-full bg-muted/40 py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-6xl space-y-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2"
          onClick={() => navigate("/getting-started")}
        >
          ← Back
        </Button>
        {/* Top section */}
        <div className="flex flex-col gap-4">
          <div className="inline-flex items-center gap-2">
            <Badge variant="outline">Go-independent Launch Planner</Badge>
            <span className="text-xs text-muted-foreground">
              Guided setup · 10–15 minutes
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Plan your path to your first paying patients
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              Answer a few focused questions and we&apos;ll turn your ideas into
              a simple launch plan – tailored to you, your patients and your
              country.
            </p>
          </div>

          {/* Stepper + progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Step {currentStepIndex + 1} of {STEPS.length} · {currentStep}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-muted">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          {/* Left: current step */}
          <Card className="border border-border bg-background">
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                {renderStepTitle(currentStep)}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {renderStepSubtitle(currentStep)}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* STEP-FORMS */}
              {currentStep === "Starting point" && (
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="profession">Your professional background</Label>
                    <Input
                      id="profession"
                      placeholder="Physiotherapist, nurse, osteopath, personal trainer…"
                      value={startingPoint.profession}
                      onChange={(e) =>
                        setStartingPoint((prev) => ({ ...prev, profession: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Experience level</Label>
                    <Select
                      value={startingPoint.experienceLevel}
                      onValueChange={(val) =>
                        setStartingPoint((prev) => ({ ...prev, experienceLevel: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose your experience level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student / new graduate</SelectItem>
                        <SelectItem value="1-3">1–3 years of experience</SelectItem>
                        <SelectItem value="3-10">3–10 years of experience</SelectItem>
                        <SelectItem value="10+">10+ years of experience</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Why do you want to go independent?</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {[
                        "More freedom in my schedule",
                        "Higher income potential",
                        "More control over how I treat patients",
                        "Build a premium brand / niche",
                        "Side income next to my job",
                      ].map((item) => (
                        <label
                          key={item}
                          className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={startingPoint.primaryMotivations.includes(item)}
                            onCheckedChange={() => toggleMotivation(item)}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lifestyleGoal">
                      If your practice works well, how would your ideal work week look in 2 years?
                    </Label>
                    <Textarea
                      id="lifestyleGoal"
                      placeholder="Example: 20–25 patient sessions per week, 1 admin day, Fridays off…"
                      value={startingPoint.lifestyleGoal}
                      onChange={(e) =>
                        setStartingPoint((prev) => ({ ...prev, lifestyleGoal: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}

              {currentStep === "Niche & audience" && (
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="primaryNiche">Who do you most want to help?</Label>
                    <Input
                      id="primaryNiche"
                      placeholder="Example: runners with knee pain, post-op hip patients…"
                      value={nicheAudience.primaryNiche}
                      onChange={(e) =>
                        setNicheAudience((prev) => ({ ...prev, primaryNiche: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>What types of problems will you mainly work with?</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {[
                        "Acute injuries",
                        "Chronic pain",
                        "Post-operative rehab",
                        "Sports performance",
                        "Workplace / ergonomics",
                        "Women’s health",
                        "General MSK",
                      ].map((item) => (
                        <label
                          key={item}
                          className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={nicheAudience.problemTypes.includes(item)}
                            onCheckedChange={() => toggleProblemType(item)}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="idealPatient">Describe your ideal patient in one or two sentences.</Label>
                    <Textarea
                      id="idealPatient"
                      placeholder='Example: "Active women in their 30s–40s who struggle with recurring hip pain and have tried everything without lasting results."'
                      value={nicheAudience.idealPatient}
                      onChange={(e) =>
                        setNicheAudience((prev) => ({ ...prev, idealPatient: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Where will you mainly work?</Label>
                    <Select
                      value={nicheAudience.workMode}
                      onValueChange={(val) =>
                        setNicheAudience((prev) => ({ ...prev, workMode: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose your main mode of work" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local in-person only</SelectItem>
                        <SelectItem value="hybrid">Hybrid: local + online</SelectItem>
                        <SelectItem value="online">Fully online</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {currentStep === "Services & pricing" && (
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="coreServiceName">Core service</Label>
                    <Input
                      id="coreServiceName"
                      placeholder="Initial assessment (60 min)"
                      value={servicesPricing.coreServiceName}
                      onChange={(e) =>
                        setServicesPricing((prev) => ({ ...prev, coreServiceName: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="coreServiceDescription">Short description</Label>
                    <Textarea
                      id="coreServiceDescription"
                      placeholder="Full assessment, hands-on treatment and a clear plan for the next 4 weeks."
                      value={servicesPricing.coreServiceDescription}
                      onChange={(e) =>
                        setServicesPricing((prev) => ({
                          ...prev,
                          coreServiceDescription: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="coreServicePrice">Price per session</Label>
                    <Input
                      id="coreServicePrice"
                      placeholder="Example: 750 DKK"
                      value={servicesPricing.coreServicePrice}
                      onChange={(e) =>
                        setServicesPricing((prev) => ({ ...prev, coreServicePrice: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="packageName">Optional package / program</Label>
                    <Input
                      id="packageName"
                      placeholder="6-week Back on Track program"
                      value={servicesPricing.packageName}
                      onChange={(e) =>
                        setServicesPricing((prev) => ({ ...prev, packageName: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="packageDescription">What’s included?</Label>
                    <Textarea
                      id="packageDescription"
                      placeholder="1 x 60 min assessment + 4 x 45 min follow-up + messaging support"
                      value={servicesPricing.packageDescription}
                      onChange={(e) =>
                        setServicesPricing((prev) => ({
                          ...prev,
                          packageDescription: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="packagePrice">Package price</Label>
                    <Input
                      id="packagePrice"
                      placeholder="Example: 4.500 DKK"
                      value={servicesPricing.packagePrice}
                      onChange={(e) =>
                        setServicesPricing((prev) => ({ ...prev, packagePrice: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="incomeGoal">
                      What monthly income would you like your practice to generate (before tax)?
                    </Label>
                    <Input
                      id="incomeGoal"
                      placeholder="Example: 25.000 DKK / 50.000 DKK…"
                      value={servicesPricing.incomeGoal}
                      onChange={(e) =>
                        setServicesPricing((prev) => ({ ...prev, incomeGoal: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}

              {currentStep === "Business setup" && (
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <Label>Business stage</Label>
                    <Select
                      value={businessSetup.stage}
                      onValueChange={(val) =>
                        setBusinessSetup((prev) => ({ ...prev, stage: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Where are you right now?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-business">I don’t have a registered business yet</SelectItem>
                        <SelectItem value="have-business">I have a business but I’m not really using it</SelectItem>
                        <SelectItem value="running">I already run a small practice and want to grow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>How do you plan to register?</Label>
                    <p className="text-xs text-muted-foreground">
                      Start with what matters most to you. We&apos;ll suggest typical company types based on your choice.
                    </p>

                    <TooltipProvider>
                      <div className="grid gap-2 md:grid-cols-3">
                        <button
                          type="button"
                          onClick={() =>
                            setBusinessSetup((prev) => ({
                              ...prev,
                              registerPreference: "simple",
                              legalStructure: "",
                            }))
                          }
                          className={`flex h-full flex-col items-start justify-between rounded-lg border px-3 py-3 text-left text-sm transition ${
                            businessSetup.registerPreference === "simple"
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:bg-muted/60"
                          }`}
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <span className="font-medium">I want something simple to start</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-help">
                                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                <ul className="list-disc space-y-1 pl-4">
                                  <li>Typical: PMV or sole trader (enkeltmandsvirksomhed)</li>
                                  <li>Easy to start and close down</li>
                                  <li>You and the business are the same legally</li>
                                  <li>Personal liability if something goes wrong</li>
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Best if you&apos;re testing your idea or starting small on your own.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setBusinessSetup((prev) => ({
                              ...prev,
                              registerPreference: "liability",
                              legalStructure: "",
                            }))
                          }
                          className={`flex h-full flex-col items-start justify-between rounded-lg border px-3 py-3 text-left text-sm transition ${
                            businessSetup.registerPreference === "liability"
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:bg-muted/60"
                          }`}
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <span className="font-medium">
                              I want limited liability and a more professional structure
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-help">
                                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                <ul className="list-disc space-y-1 pl-4">
                                  <li>Typical: ApS (private limited company)</li>
                                  <li>Separate legal entity from you</li>
                                  <li>Limited personal liability</li>
                                  <li>More admin and higher setup cost</li>
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Good if you see this as a long-term clinic and want protection and structure.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setBusinessSetup((prev) => ({
                              ...prev,
                              registerPreference: "multi",
                              legalStructure: "",
                            }))
                          }
                          className={`flex h-full flex-col items-start justify-between rounded-lg border px-3 py-3 text-left text-sm transition ${
                            businessSetup.registerPreference === "multi"
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:bg-muted/60"
                          }`}
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <span className="font-medium">We are two or more owners</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-help">
                                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                <ul className="list-disc space-y-1 pl-4">
                                  <li>Typical: I/S (partnership) or joint ApS</li>
                                  <li>Important to have a written owners&apos; agreement</li>
                                  <li>In I/S you share personal liability</li>
                                  <li>ApS can protect each owner better</li>
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            For clinics built together with a partner or a small group from day one.
                          </p>
                        </button>
                      </div>
                    </TooltipProvider>

                    {businessSetup.registerPreference && (
                      <div className="space-y-1 pt-3">
                        <Label htmlFor="legalStructureDetail">Based on that, what fits you best?</Label>
                        <Select
                          value={businessSetup.legalStructure}
                          onValueChange={(val) =>
                            setBusinessSetup((prev) => ({ ...prev, legalStructure: val }))
                          }
                        >
                          <SelectTrigger id="legalStructureDetail">
                            <SelectValue placeholder="Choose a typical company type" />
                          </SelectTrigger>
                          <SelectContent>
                            {businessSetup.registerPreference === "simple" && (
                              <>
                                <SelectItem value="pmv">PMV – very small personal business</SelectItem>
                                <SelectItem value="enkeltmands">Sole trader / enkeltmandsvirksomhed</SelectItem>
                              </>
                            )}

                            {businessSetup.registerPreference === "liability" && (
                              <>
                                <SelectItem value="aps">ApS – private limited company</SelectItem>
                                <SelectItem value="as">A/S – public limited company (advanced)</SelectItem>
                              </>
                            )}

                            {businessSetup.registerPreference === "multi" && (
                              <>
                                <SelectItem value="is">I/S – partnership (shared personal liability)</SelectItem>
                                <SelectItem value="joint-aps">Joint ApS owned by two or more people</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          This is not legal advice – it simply helps you think in the right direction. Talk to an
                          accountant or advisor before you decide.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Which essentials do you already feel clear about?</Label>
                    {[
                      {
                        key: "hasDocumentationPlan",
                        label: "Patient notes and documentation",
                      },
                      {
                        key: "hasInsurancePlan",
                        label: "Required insurances",
                      },
                      {
                        key: "hasDataPrivacyPlan",
                        label: "Data privacy and patient information",
                      },
                      {
                        key: "hasPaymentSetup",
                        label: "How patients can pay you",
                      },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={businessSetup[item.key] === true}
                          onCheckedChange={() =>
                            setBusinessSetup((prev) => ({
                              ...prev,
                              [item.key]: !(prev[item.key] === true),
                            }))
                          }
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>Where do you feel most unsure right now?</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {[
                        "Pricing and finances",
                        "Legal structure and contracts",
                        "Marketing and getting patients",
                        "Systems and software",
                      ].map((item) => (
                        <label
                          key={item}
                          className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={businessSetup.unsureAreas.includes(item)}
                            onCheckedChange={() => toggleUnsureArea(item)}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === "First patients" && (
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <Label>
                      If you had to choose only one main channel for the next 30 days, which would it be?
                    </Label>
                    <Select
                      value={firstPatients.chosenChannel}
                      onValueChange={(val) =>
                        setFirstPatients((prev) => ({ ...prev, chosenChannel: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose your primary channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friends-family">Friends and family</SelectItem>
                        <SelectItem value="former-colleagues">Former colleagues</SelectItem>
                        <SelectItem value="clubs-gyms">Local sports clubs / gyms</SelectItem>
                        <SelectItem value="companies">Companies / workplaces</SelectItem>
                        <SelectItem value="social-media">Social media</SelectItem>
                        <SelectItem value="referrals">Referrals from other health professionals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Which other channels will you also touch?</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {[
                        "Friends and family",
                        "Local sports clubs / gyms",
                        "Companies / workplaces",
                        "Social media",
                        "Referrals from other health professionals",
                      ].map((item) => (
                        <label
                          key={item}
                          className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={firstPatients.otherChannels.includes(item)}
                            onCheckedChange={() => toggleOtherChannel(item)}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="introMessage">
                      How would you introduce yourself in 2–3 sentences to a potential patient or partner?
                    </Label>
                    <Textarea
                      id="introMessage"
                      placeholder='Example: "Hi, I’m [Name], a physiotherapist helping runners with knee and hip pain get back to pain-free training. I’ve just opened for new clients in [City]."'
                      value={firstPatients.introMessage}
                      onChange={(e) =>
                        setFirstPatients((prev) => ({ ...prev, introMessage: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}

              {currentStep === "Summary" && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">Launch overview</h3>
                      <p className="text-xs text-muted-foreground">
                        A snapshot of who you are building this for and how you want to work.
                      </p>
                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-[11px] font-medium uppercase text-muted-foreground">
                            Professional identity
                          </dt>
                          <dd className="mt-0.5 text-foreground">
                            {startingPoint.profession || "Add your profession in Step 1"}
                            {startingPoint.experienceLevel && ` · ${startingPoint.experienceLevel} experience`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase text-muted-foreground">Niche & audience</dt>
                          <dd className="mt-0.5 whitespace-pre-line text-foreground">
                            {nicheAudience.primaryNiche || "Define your niche in Step 2"}
                            {nicheAudience.idealPatient ? `\n${nicheAudience.idealPatient}` : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase text-muted-foreground">Way of working</dt>
                          <dd className="mt-0.5 text-foreground">
                            {nicheAudience.workMode === "local" && "Mainly local, in-person sessions"}
                            {nicheAudience.workMode === "hybrid" && "Hybrid: local sessions + online follow-ups"}
                            {nicheAudience.workMode === "online" && "Primarily online coaching / rehab"}
                            {!nicheAudience.workMode && "Choose your main mode in Step 2"}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">Your offer & numbers</h3>
                      <p className="text-xs text-muted-foreground">
                        What you&apos;re selling and the income you&apos;re aiming for.
                      </p>
                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-[11px] font-medium uppercase text-muted-foreground">Core service</dt>
                          <dd className="mt-0.5 whitespace-pre-line text-foreground">
                            {servicesPricing.coreServiceName || "Add your core service in Step 3"}
                            {servicesPricing.coreServiceDescription ? `\n${servicesPricing.coreServiceDescription}` : ""}
                            {servicesPricing.coreServicePrice && (
                              <span className="block text-xs text-muted-foreground">
                                {servicesPricing.coreServicePrice} per session
                              </span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase text-muted-foreground">Package / program</dt>
                          <dd className="mt-0.5 whitespace-pre-line text-foreground">
                            {servicesPricing.packageName || "Optional – you can add a package later"}
                            {servicesPricing.packageDescription ? `\n${servicesPricing.packageDescription}` : ""}
                            {servicesPricing.packagePrice && (
                              <span className="block text-xs text-muted-foreground">{servicesPricing.packagePrice}</span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase text-muted-foreground">Income goal</dt>
                          <dd className="mt-0.5 text-foreground">
                            {servicesPricing.incomeGoal || "Set a monthly target in Step 3"}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">Next 30 days</h3>
                      <p className="text-xs text-muted-foreground">
                        Concrete focus so you can move from planning to your first paying patients.
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex gap-2">
                          <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
                            1
                          </span>
                          <span>
                            Commit to{" "}
                            <span className="font-medium">
                              {firstPatients.chosenChannel
                                ? firstPatients.chosenChannel.replace(/-/g, " ")
                                : "your main channel from Step 5"}
                            </span>{" "}
                            as your primary way of getting your first patients.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
                            2
                          </span>
                          <span>
                            Reach out to at least <span className="font-medium">10 people</span> from your network or
                            audience in the next 2 weeks.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
                            3
                          </span>
                          <span>
                            Use your intro message as a template:
                            <span className="mt-1 block rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                              {firstPatients.introMessage ||
                                "Write a short 2–3 sentence intro in Step 5 that you can reuse in messages and posts."}
                            </span>
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
                            4
                          </span>
                          <span>
                            Block <span className="font-medium">2 hours per week</span> for documentation, systems and
                            business setup so you stay ahead of the admin.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
                    This roadmap is a living document. You can adjust your answers and focus as you learn more about your
                    patients, your market and how you like to work.
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goBack}
                    disabled={currentStepIndex === 0}
                  >
                    Back
                  </Button>
                  <Button variant="ghost" size="sm">
                    Save draft
                  </Button>
                </div>
                <Button size="sm" onClick={goNext}>
                  {currentStepIndex === STEPS.length - 1 ? "Finish" : "Next step"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right: snapshot / preview */}
          <div className="space-y-4 lg:sticky lg:top-24">
            <Card className="border border-border/80 bg-background/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Check className="h-4 w-4 text-primary" />
                  Your launch snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground/70">
                    Professional identity
                  </div>
                  <div className="mt-1 text-sm">
                    {/* Her kan du senere vise fx profession + erfaring */}
                    Physiotherapist · early-stage independent
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground/70">
                    Niche & audience
                  </div>
                  <div className="mt-1 text-sm">
                    Runners with knee pain in Copenhagen
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground/70">
                    Income goal
                  </div>
                  <div className="mt-1 text-sm">DKK 35.000 / month</div>
                </div>

                <div className="mt-4 rounded-md bg-muted px-3 py-2 text-xs">
                  This overview will update as you move through the steps – so
                  you always see where you&apos;re heading.
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              You can change your answers at any time. The goal is momentum, not
              perfection.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderStepTitle(step) {
  switch (step) {
    case "Starting point":
      return "Define your starting point"
    case "Niche & audience":
      return "Choose your niche and audience"
    case "Services & pricing":
      return "Decide what you offer and what you charge"
    case "Business setup":
      return "Set up the essentials"
    case "First patients":
      return "Get your first 10 patients"
    case "Summary":
      return "Review your launch roadmap"
    default:
      return step
  }
}

function renderStepSubtitle(step) {
  switch (step) {
    case "Starting point":
      return "Clarify who you are, how you want to work, and what success means to you."
    case "Niche & audience":
      return "You don’t have to treat everyone. Let’s define who you’re really building this for."
    case "Services & pricing":
      return "Turn your skills into clear services with simple, transparent pricing."
    case "Business setup":
      return "No legal jargon – just the essentials you need to operate safely and professionally."
    case "First patients":
      return "Focus on real people, not algorithms. Let’s plan your first 10 paying patients."
    case "Summary":
      return "See your key decisions and next actions in one simple launch plan."
    default:
      return ""
  }
}

export default LaunchPlannerPage
