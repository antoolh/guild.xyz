import { useMachine } from "@xstate/react"
import replacer from "components/common/utils/guildJsonReplacer"
import useJsConfetti from "hooks/useJsConfetti"
import usePersonalSign from "hooks/usePersonalSign"
import useShowErrorToast from "hooks/useShowErrorToast"
import useToast from "hooks/useToast"
import { useRouter } from "next/router"
import { useSWRConfig } from "swr"
import { assign, createMachine, DoneInvokeEvent } from "xstate"

export type ContextType = {
  data: any
}

export type FetchEvent = DoneInvokeEvent<Response | Response[]>

const machine = createMachine<ContextType>(
  {
    initial: "idle",
    states: {
      idle: {
        on: {
          SUBMIT: "fetchData",
        },
      },
      fetchData: {
        entry: "saveData",
        invoke: {
          src: "fetchData",
          onDone: [
            {
              target: "success",
              cond: "fetchSuccessful",
            },
            {
              target: "parseError",
              cond: "fetchFailed",
            },
          ],
          onError: "error",
        },
      },
      success: {
        entry: ["showSuccessToast", "redirect"],
      },
      parseError: {
        invoke: {
          src: "parseError",
          onDone: "error",
          onError: "error",
        },
      },
      error: {
        entry: "showErrorToast",
        on: {
          SUBMIT: "fetchData",
        },
      },
    },
  },
  {
    services: {
      parseError: (_context, event: FetchEvent) => {
        if (Array.isArray(event.data)) {
          return Promise.all(event.data.map((res) => res.json())).catch(() =>
            Promise.reject(new Error("Network error"))
          )
        }
        return event.data
          .json()
          .catch(() => Promise.reject(new Error("Network error")))
      },
    },
    guards: {
      fetchSuccessful: (_context, event: FetchEvent) => {
        if (Array.isArray(event.data)) return event.data.every(({ ok }) => !!ok)
        return !!event.data.ok
      },
      fetchFailed: (_context, event: FetchEvent) => {
        if (Array.isArray(event.data)) return event.data.some(({ ok }) => !ok)
        return !event.data.ok
      },
    },
    actions: {
      saveData: assign((_, { data }: any) => ({
        data,
      })),
    },
  }
)

const useSubmitMachine = (type: "group" | "guild") => {
  const { mutate } = useSWRConfig()
  const toast = useToast()
  const showErrorToast = useShowErrorToast()
  const triggerConfetti = useJsConfetti()
  const router = useRouter()
  const { addressSignedMessage } = usePersonalSign()

  const [state, send] = useMachine(machine, {
    services: {
      fetchData: async (_, { data }) =>
        fetch(`${process.env.NEXT_PUBLIC_API}/${type}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            { ...data, addressSignedMessage },
            type === "guild" ? replacer : undefined
          ),
        }),
    },
    actions: {
      showErrorToast: (_context, { data: error }: any) => {
        if (error instanceof Error) showErrorToast(error.message)
        else showErrorToast(error.errors)
      },
      showSuccessToast: (context) => {
        triggerConfetti()
        toast({
          title: `${type === "group" ? "Group" : "Guild"} successfully created!`,
          description: "You're being redirected to it's page",
          status: "success",
          duration: 4000,
        })
        // refetch groups to include the new one on the home page
        mutate(type === "group" ? "groups" : "guilds")
        router.push(`${type === "group" ? "/" : "/guild/"}${context.data.urlName}`)
      },
    },
  })

  const onSubmit = (data) => {
    send("SUBMIT", { data })
  }

  return {
    onSubmit,
    isLoading: ["fetchData", "parseError"].some(state.matches),
    state,
    isSuccess: state.matches("success"),
  }
}

export default useSubmitMachine