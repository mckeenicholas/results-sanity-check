const fetchGraphQL = async (url, operationName, variables, query) => {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operationName, variables, query }),
    };
  
    const response = await fetch(url, requestOptions);
    return await response.json();
  };
  
  const getLiveCompId = async (name) => {
    const queryCompetitions = `query Competitions($filter: String!) {
          competitions(filter: $filter, limit: 10) {
              id
              name
          }
      }`;
  
    const { data } = await fetchGraphQL(
      'https://live.worldcubeassociation.org/api',
      'Competitions',
      { filter: name },
      queryCompetitions
    );
  
    const competition = data.competitions.find((comp) => comp.name === name);
    if (!competition) return [];
  
    const queryRounds = `query Competition($id: ID!) {
          competition(id: $id) {
              competitionEvents {
                  id
                  event {
                      id
                      name
                  }
                  rounds {
                      id
                      name
                      label
                  }
              }
          }
      }`;
  
    const eventData = await fetchGraphQL(
      'https://live.worldcubeassociation.org/api',
      'Competition',
      { id: competition.id },
      queryRounds
    );
    return eventData.data.competition.competitionEvents;
  };
  
  const getResults = async (roundid) => {
    const query = `query Round($id: ID!) {
          round(id: $id) {
              id
              name
              competitionEvent {
                  id
                  event {
                      id
                      name
                  }
              }
              format {
                  id
                  numberOfAttempts
              }
              results {
                  id
                  ...roundResult
              }
          }
      }
    
      fragment roundResult on Result {
          attempts {
              result
          }
          person {
              id
              name
          }
      }`;
  
    return await fetchGraphQL(
      'https://live.worldcubeassociation.org/api',
      'Round',
      { id: roundid },
      query
    );
  };
  
  const checkResults = async (compid) => {
    const wcifUrl = `https://www.worldcubeassociation.org/api/v0/competitions/${compid}/wcif/public`;
    const wcif = await fetch(wcifUrl).then((response) => response.json());
  
    const rounds = await getLiveCompId(wcif.name);
    let hasError = false;
  
    const eventResults = await Promise.all(
      rounds.map(async (event) => {
        const results = await Promise.all(
          event.rounds.map(async (round) => {
            return await getResults(round.id);
          })
        );
        return results;
      })
    );
  
    for (const event of eventResults) {
      for (let i = 0; i < event.length; i++) {
        const wcifEvent = wcif.events.find(
          (wcifEvent) => wcifEvent.id === event[i].data.round.competitionEvent.event.id
        );
        const wcifRound = wcifEvent.rounds[i];
        for (let j = 0; j < event[i].data.round.results.length; j++) {
          const liveAttempt = event[i].data.round.results[j];
          const wcifAttempt = wcifRound.results[j].attempts;
          for (let k = 0; k < liveAttempt.attempts.length; k++) {
            if (liveAttempt.attempts[k].result !== wcifAttempt[k].result) {
              const formattedError = `Error detected on ${liveAttempt.person.name}, ${
                wcifRound.id
              }, attempt ${k + 1}, WCA displays result ${
                liveAttempt.attempts[k].result
              }, WCIF has result ${wcifAttempt[k].result}`;
              console.log(formattedError);
              hasError = true;
            }
          }
        }
      }
    }
  
    return hasError;
  };
  
  if (process.argv.length <= 2) {
    console.error('Missing argument: competition id');
    process.exit(1);
  }
  
  if (!checkResults(process.argv[2])) {
    console.log("No errors found")
  }
  