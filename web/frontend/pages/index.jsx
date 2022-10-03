import {
  Card,
  Page,
  Layout,
  TextContainer,
  Image,
  Stack,
  Link,
  Heading,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { trophyImage } from "../assets";

import { ProductsCard } from "../components";
import DiscountCodes from "../components/Discount/DiscountCodes";
import DiscountOrders from "../components/Discount/DiscountOrders";

export default function HomePage() {
  return (
    <Page narrowWidth>
      <Layout>
        <Layout.Section>
          <Card sectioned>
          <DiscountOrders/>
          </Card>
        </Layout.Section>
      
      </Layout>
    </Page>
  );
}
