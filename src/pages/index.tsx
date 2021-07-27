import { Stack } from "@chakra-ui/react"
import CategorySection from "components/allCommunities/CategorySection"
import CommunityCard from "components/allCommunities/CommunityCard"
import { CommunityProvider } from "components/community/Context"
import Layout from "components/Layout"
import { GetStaticProps } from "next"
import React, { useRef } from "react"
import type { Community } from "temporaryData/communities"
import { communities as communitiesJSON } from "temporaryData/communities"
import tokens from "temporaryData/tokens"

// Set this to true if you don't want the data to be fetched from backend
const DEBUG = false

type Props = {
  communities: Community[]
}

/**
 * Instead of loopig through communities and building 3 arrays categorizing them then
 * rendering CommunityCards of those arrys in the CategorySection components, we just
 * render all CommunityCards here and mount them into the appropriate section via
 * Portals, because this way we can use our existing hooks for the logic of where
 * they belong to.
 */
const AllCommunities = ({ communities: allCommunities }: Props): JSX.Element => {
  const refAccess = useRef<HTMLDivElement>(null)

  return (
    <Layout title="All communities on Agora">
      <Stack spacing={8}>
        <CategorySection
          title="Your communities"
          placeholder="You don't have access to any communities"
          ref={refAccess}
        />
        <CategorySection
          title="Other tokenized communities"
          placeholder="There aren't any other communities"
        >
          {allCommunities.map((community) => (
            /**
             * Wrapping in CommunityProvider instead of just passing the data because
             * it provides the current chain's data for the useLevelAccess hook and tokenSymbol
             */
            <CommunityProvider
              data={community}
              shouldRenderWrapper={false}
              key={community.id}
            >
              <CommunityCard refAccess={refAccess} />
            </CommunityProvider>
          ))}
        </CategorySection>
      </Stack>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const communities =
    DEBUG && process.env.NODE_ENV !== "production"
      ? communitiesJSON
      : await fetch(`${process.env.NEXT_PUBLIC_API}/community`).then((response) =>
          response.ok ? response.json() : communitiesJSON
        )

  return { props: { communities: [...communities, ...tokens] } }
}

export default AllCommunities
