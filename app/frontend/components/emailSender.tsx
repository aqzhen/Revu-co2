import React, { useState } from "react";
import {
  FormLayout,
  TextField,
  Checkbox,
  Button,
  Card,
  Layout,
} from "@shopify/polaris";

const EmailSender = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sendTime, setSendTime] = useState("");
  const [automateForNewSegments, setAutomateForNewSegments] = useState(false);
  const [updateFrequency, setUpdateFrequency] = useState("");

  const handleEmailChange = (value: any) => {
    setEmail(value);
  };

  const handleMessageChange = (value: any) => {
    setMessage(value);
  };

  const handleSendTimeChange = (value: any) => {
    setSendTime(value);
  };

  const handleAutomateForNewSegmentsChange = (value: any) => {
    setAutomateForNewSegments(value);
  };

  const handleUpdateFrequencyChange = (value: any) => {
    setUpdateFrequency(value);
  };

  const handleSubmit = async () => {
    // Your submit logic here
    console.log("Form submitted");
  };

  return (
    <Layout.Section>
      <Card>
        <form onSubmit={handleSubmit}>
          <FormLayout>
            <TextField
              label="Email"
              value={email}
              onChange={handleEmailChange}
              type="email"
              autoComplete="false"
            />
            <TextField
              label="Message"
              value={message}
              onChange={handleMessageChange}
              multiline
              autoComplete="false"
            />
            <TextField
              label="Send Time"
              value={sendTime}
              onChange={handleSendTimeChange}
              type="datetime-local"
              autoComplete="false"
            />
            <Checkbox
              label="Automate for New Segments"
              checked={automateForNewSegments}
              onChange={handleAutomateForNewSegmentsChange}
            />
            <TextField
              label="Update Frequency"
              value={updateFrequency}
              onChange={handleUpdateFrequencyChange}
              autoComplete="false"
            />
            <Button submit>Send Email</Button>
          </FormLayout>
        </form>
      </Card>

      <Card>
        <p>
          <strong>Coming Soon:</strong>
        </p>
        <p>
          Workflow automations for custom in-store popups, post-purchase
          followups, landing page customization and more!
        </p>
      </Card>
    </Layout.Section>
  );
};

export default EmailSender;
